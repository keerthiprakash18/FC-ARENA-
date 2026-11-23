import importlib.util
from pathlib import Path
import unittest
import hashlib
import json
import tempfile
from unittest.mock import patch
from types import SimpleNamespace

path=Path(__file__).resolve().parents[1]/'release/managed_runtime.py'
spec=importlib.util.spec_from_file_location('managed_runtime',path)
runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)

class ManagedRuntimeTests(unittest.TestCase):
    def test_historical_checksums_accept_only_equivalent_line_endings(self):
        with tempfile.TemporaryDirectory() as raw:
            file=Path(raw)/'migration.sql';lf=b'CREATE TABLE example (id int);\n';crlf=lf.replace(b'\n',b'\r\n')
            file.write_bytes(lf)
            allowed=runtime.migration_checksums(file)
            self.assertEqual(allowed,{hashlib.sha256(lf).hexdigest(),hashlib.sha256(crlf).hexdigest()})
            file.write_bytes(crlf);self.assertEqual(runtime.migration_checksums(file),allowed)
            self.assertNotIn(hashlib.sha256(b'DROP TABLE example;\n').hexdigest(),allowed)

    def test_schema_change_requires_bound_additive_migration_approval(self):
        with tempfile.TemporaryDirectory() as raw:
            root=Path(raw);old=root/'old';new=root/'new'
            for folder in [old,new]:
                schema=folder/'apps/api/prisma';(schema/'migrations/old').mkdir(parents=True)
                (schema/'schema.prisma').write_bytes(b'baseline')
                (schema/'migrations/old/migration.sql').write_bytes(b'baseline migration')
            runtime.require_schema_parity(old,new)
            schema=new/'apps/api/prisma';(schema/'schema.prisma').write_bytes(b'candidate')
            with self.assertRaises(AssertionError):runtime.require_schema_parity(old,new)
            migration=schema/runtime.SOCIAL_MIGRATION;migration.parent.mkdir()
            migration.write_bytes((path.parents[2]/'apps/api/prisma'/runtime.SOCIAL_MIGRATION).read_bytes())
            proof={'status':'APPLIED_AND_VERIFIED','approvedBy':'owner','baselineRuntime':str(old.resolve()),'candidateRuntime':str(new.resolve()),
              'baselineSchemaSha256':hashlib.sha256(b'baseline').hexdigest(),'candidateSchemaSha256':hashlib.sha256(b'candidate').hexdigest(),
              'migrationSha256':runtime.SOCIAL_MIGRATION_HASH}
            runtime.require_schema_parity(old,new,proof)
            for key,value in [('approvedBy','agent'),('status','PENDING'),('candidateSchemaSha256','wrong'),('baselineRuntime','other')]:
                with self.subTest(key=key),self.assertRaises(AssertionError):runtime.require_schema_parity(old,new,{**proof,key:value})
            migration.write_bytes(b'DROP TABLE users;')
            with self.assertRaises(AssertionError):runtime.require_schema_parity(old,new,proof)
            migration.write_bytes((path.parents[2]/'apps/api/prisma'/runtime.SOCIAL_MIGRATION).read_bytes())
            (schema/'migrations/old/migration.sql').write_bytes(b'changed history')
            with self.assertRaises(AssertionError):runtime.require_schema_parity(old,new,proof)

    def test_applied_migration_proof_requires_fresh_recovery_and_exact_live_ledger(self):
        with tempfile.TemporaryDirectory() as raw:
            candidate=Path(raw);migration=candidate/'apps/api/prisma'/runtime.SOCIAL_MIGRATION;migration.parent.mkdir(parents=True)
            migration.write_bytes((path.parents[2]/'apps/api/prisma'/runtime.SOCIAL_MIGRATION).read_bytes())
            now=runtime.dt.datetime.now(runtime.dt.timezone.utc)
            ledger=[{'migration_name':migration.parent.name,'checksum':runtime.SOCIAL_MIGRATION_HASH,'finished':True,'rolled_back':False}]
            proof={'release':'candidate','baselineRelease':'baseline','approvedBy':'owner','status':'APPLIED_AND_VERIFIED','approvedAt':now.isoformat(),
              'rehearsal':'rehearsal.json','backupSha256':'backup','appliedLedger':ledger,'migrationSha256':runtime.SOCIAL_MIGRATION_HASH}
            rehearsal={'status':'PASS','release':'candidate','baselineRelease':'baseline','migrationSha256':runtime.SOCIAL_MIGRATION_HASH,
              'postgresMajor':17,'existingDataPreserved':True,'baselineAfterMigrationHealthy':True,'candidateAfterMigrationHealthy':True}
            backup={'latestSha256':'backup','latestFile':'archive.gpg','lastLocalBackupAt':now.isoformat(),'unavailableProviderAssets':0}
            receipt={'sha256':'backup','file':'archive.gpg','lastVerifiedRestoreAt':now.isoformat()}
            def read(file,*args,**kwargs):
                return json.dumps({'approval.json':proof,'rehearsal.json':rehearsal,'latest.json':backup,'offhost-receipt.json':receipt}[file.name])
            actual_stat=Path.stat
            def private_stat(file,*args,**kwargs):
                if file.name=='approval.json':return SimpleNamespace(st_uid=0,st_mode=0o600)
                return actual_stat(file,*args,**kwargs)
            with patch.object(Path,'stat',private_stat),patch.object(Path,'is_symlink',return_value=False),patch.object(Path,'read_text',read),patch.object(runtime,'command',return_value=json.dumps(ledger)) as query:
                self.assertTrue(candidate.is_dir())
                self.assertEqual(runtime.approved_schema_proof('approval.json',candidate,'candidate','baseline'),proof)
                query.return_value='[]'
                with self.assertRaises(AssertionError):runtime.approved_schema_proof('approval.json',candidate,'candidate','baseline')
                query.return_value=json.dumps(ledger);receipt['file']='older.gpg'
                with self.assertRaises(AssertionError):runtime.approved_schema_proof('approval.json',candidate,'candidate','baseline')
                receipt['file']='archive.gpg';rehearsal['postgresMajor']=18
                with self.assertRaises(AssertionError):runtime.approved_schema_proof('approval.json',candidate,'candidate','baseline')
                rehearsal['postgresMajor']=17;proof['approvedAt']=(now-runtime.dt.timedelta(days=2)).isoformat()
                with self.assertRaises(AssertionError):runtime.approved_schema_proof('approval.json',candidate,'candidate','baseline')

    def test_duo_transition_accepts_only_exact_nullable_field_and_reviewed_sql(self):
        with tempfile.TemporaryDirectory() as raw:
            root=Path(raw);old=root/'old';new=root/'new';baseline=b'model Match {\n  id String @id\n}\n'
            candidate=baseline.replace(b'}\n',runtime.DUO_SCHEMA_FIELD+b'}\n')
            for folder,content in [(old,baseline),(new,candidate)]:
                schema=folder/'apps/api/prisma';(schema/'migrations/old').mkdir(parents=True)
                (schema/'schema.prisma').write_bytes(content)
                (schema/'migrations/old/migration.sql').write_bytes(b'baseline migration')
            schema=new/'apps/api/prisma';migration=schema/runtime.DUO_MIGRATION;migration.parent.mkdir()
            sql=(path.parents[2]/'apps/api/prisma'/runtime.DUO_MIGRATION).read_bytes();migration.write_bytes(sql)
            proof={'status':'APPLIED_AND_VERIFIED','approvedBy':'owner','baselineRuntime':str(old.resolve()),'candidateRuntime':str(new.resolve()),
              'baselineSchemaSha256':hashlib.sha256(baseline).hexdigest(),'candidateSchemaSha256':hashlib.sha256(candidate).hexdigest(),'migrationSha256':runtime.DUO_MIGRATION_HASH}
            runtime.require_schema_parity(old,new,proof)
            with self.assertRaises(AssertionError):runtime.require_schema_parity(old,new)
            with self.assertRaises(AssertionError):runtime.require_schema_parity(old,new,{**proof,'migrationSha256':runtime.SOCIAL_MIGRATION_HASH})
            migration.write_bytes(b'ALTER TABLE matches DROP COLUMN id;')
            with self.assertRaises(AssertionError):runtime.require_schema_parity(old,new,proof)
            migration.write_bytes(sql);(schema/'schema.prisma').write_bytes(candidate.replace(b'id String',b'id Int'))
            changed={**proof,'candidateSchemaSha256':hashlib.sha256((schema/'schema.prisma').read_bytes()).hexdigest()}
            with self.assertRaises(AssertionError):runtime.require_schema_parity(old,new,changed)
            (schema/'schema.prisma').write_bytes(candidate)
            extra=schema/runtime.SOCIAL_MIGRATION;extra.parent.mkdir();extra.write_bytes(b'extra')
            with self.assertRaises(AssertionError):runtime.require_schema_parity(old,new,proof)

    def test_rollback_preserves_long_override_under_short_disabled_name(self):
        target=Path('/etc/systemd/system/fcarena-web.service.d')/('z'*235+'-managed.conf')
        disabled=runtime.disabled_override_path(target,1)
        self.assertEqual(disabled.parent,target.parent)
        self.assertLess(len(disabled.name),100)
        self.assertTrue(disabled.name.endswith('.disabled'))
    def test_reload_verification_waits_for_both_replicas_and_never_accepts_only_primary(self):
        from unittest.mock import Mock
        def response(instance):return {'data':{'runtime':{'release':'sha','instance':instance}}}
        probe=Mock(side_effect=[response('api-primary')]*15+[response('api-secondary')])
        self.assertEqual(runtime.verify_public_replicas('sha',probe,lambda _:None),{'api-primary','api-secondary'})
        with self.assertRaises(AssertionError):runtime.verify_public_replicas('sha',lambda:response('api-primary'),lambda _:None)
    def test_override_fits_actual_long_legacy_filenames_and_sorts_last(self):
        old=['z'*227+'-birthday-v6-alignment.conf','z'*228+'-audit-c2dcf148fae8.conf']
        name=runtime.managed_override_name(old)
        self.assertLessEqual(len(name),255)
        self.assertTrue(all(name>prior for prior in old))
    def test_environment_preserves_literal_secrets_without_shell_expansion(self):
        encoded=runtime.encode_environment({'PRIVATE_KEY':'line1\nline2', 'VALUE':'$HOME `id` "quote" \\path', 'INVOCATION_ID':'omit'})
        self.assertIn('PRIVATE_KEY="line1\nline2"',encoded)
        self.assertIn('$HOME `id` \\"quote\\" \\\\path',encoded)
        self.assertNotIn('INVOCATION_ID',encoded)
        with self.assertRaises(AssertionError):runtime.encode_environment({'BAD\nNAME':'value'})
    def test_proxy_preserves_routes_and_does_not_replay_accepted_writes(self):
        old='location /api/ { proxy_pass http://127.0.0.1:4000; proxy_connect_timeout 60s; proxy_read_timeout 120s; }'
        new=runtime.proxy_changes(Path('fcarena-api'),old)
        self.assertIn('proxy_pass http://fcarena_api_runtime;',new)
        self.assertIn('proxy_connect_timeout 2s;',new)
        self.assertIn('proxy_read_timeout 120s;',new)
        self.assertNotIn('non_idempotent',new+runtime.UPSTREAMS)
        self.assertIn('127.0.0.1:4001',runtime.UPSTREAMS)
        self.assertIn('127.0.0.1:3001',runtime.UPSTREAMS)
    def test_instances_have_bounded_memory_and_stable_api_storage(self):
        api=runtime.service('api','secondary',Path('/opt/runtime/apps/web/.next/cache'))
        self.assertIn('WorkingDirectory=/opt/fcarena/apps/api',api)
        self.assertIn('MemoryMax=1280M',api)
        self.assertIn('Slice=fcarena-app.slice',api)
        self.assertIn('User=fcarena-api',api)
        self.assertIn('OCR_WORKER_ENABLED',runtime.SECONDARY_FLAGS)
        self.assertIn('PUSH_ENABLED',runtime.SECONDARY_FLAGS)

if __name__=='__main__':unittest.main()

import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

def module(name):
    path=Path(__file__).resolve().parents[1]/'backup'/(name+'.py')
    spec=importlib.util.spec_from_file_location(name,path);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
bundle=module('encrypted_bundle');transfer=module('backup_transfer')

class EncryptedBackupTests(unittest.TestCase):
    def test_archive_manifest_matches_actual_database_and_media(self):
        with tempfile.TemporaryDirectory() as raw:
            root=Path(raw);db=root/'database.dump';db.write_bytes(b'PGDMP-synthetic')
            media=root/'storage';media.mkdir();(media/'photo.jpg').write_bytes(b'synthetic-image')
            output=io.BytesIO();manifest=bundle.write_archive(output,db,bundle.media_entries([media]),{'providerAssets':[]})
            with tarfile.open(fileobj=io.BytesIO(output.getvalue()),mode='r:gz') as archive:
                saved=json.load(archive.extractfile('manifest.json'));self.assertEqual(saved['files'],manifest['files'])
                for row in saved['files']:
                    stream=archive.extractfile(row['path']);self.assertEqual(bundle.hashlib.sha256(stream.read()).hexdigest(),row['sha256'])
    def test_transfer_cannot_read_private_paths_or_execute_commands(self):
        with tempfile.TemporaryDirectory() as raw:
            root=Path(raw);(root/'private.env').write_text('synthetic secret')
            for args in [['fetch','../private.env'],['fetch','private.env'],['sh','-c','whoami'],['manifest','extra'],['ack','file','fake']]:
                with self.assertRaises(ValueError):transfer.serve(root,args,io.BytesIO())
    def test_receipts_require_the_actual_ciphertext_checksum(self):
        with tempfile.TemporaryDirectory() as raw:
            root=Path(raw);path=root/'fcarena-20261122T120000Z-abcdef.bundle.gpg';path.write_bytes(b'encrypted synthetic')
            sha=bundle.digest(path)
            with self.assertRaises(ValueError):transfer.serve(root,['ack',path.name,'0'*64],io.BytesIO())
            transfer.serve(root,['ack',path.name,sha,'verified'],io.BytesIO())
            state=json.loads((root/'offhost-receipt.json').read_text());self.assertIn('lastVerifiedRestoreAt',state)
            transfer.serve(root,['ack',path.name,sha],io.BytesIO())
            self.assertEqual(json.loads((root/'offhost-receipt.json').read_text())['lastVerifiedRestoreAt'],state['lastVerifiedRestoreAt'])
    def test_external_fetch_never_follows_arbitrary_hosts(self):
        for url in ['http://res.cloudinary.com/arena/image/upload/a','https://localhost/arena/image/upload/a','https://res.cloudinary.com/other/image/upload/a']:
            self.assertFalse(bundle.cloudinary_asset(url,'arena',Path('never-created')))

if __name__=='__main__':unittest.main()

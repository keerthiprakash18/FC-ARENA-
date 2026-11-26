#!/usr/bin/env python3
"""PR 230 release admission. Preflight is read-only; apply needs exact owner approval.

Build/download and isolated rehearsal happen off-host. This tool never builds,
migrates, deletes, copies media, or installs credentials on production. Activation
uses the existing managed runtime's lock, four-replica health and rollback guard.
See docs/readiness/signature-guarded-release.md for the private evidence schema.
"""
import argparse
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tarfile

REPO = 'keerthiprakash18/FC-ARENA-'
BRANCH = 'design/signature-club-experience'
GATES = ('accountDeletion', 'mediaCleanup', 'concurrentPrivacy', 'themes', 'matchCenter',
         'motion', 'accessibility', 'performance', 'security', 'functional',
         'companyCompliance', 'playConsole', 'physicalAndroid', 'isolatedStaging',
         'backupRestore', 'rollback')
WORKFLOWS = ('backend-deploy.yml', 'frontend-ci.yml', 'android-ci.yml',
             'security-hardening-ci.yml', 'codeql-security.yml', 'secrets-audit.yml',
             'readiness-steps-11-15.yml', 'readiness-steps-16-20.yml', 'load-test-acceptance.yml')


class Blocked(ValueError):
    pass


def require(value, message):
    if not value:
        raise Blocked(message)


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def fresh(value, hours=24):
    stamp = dt.datetime.fromisoformat(value)
    require(stamp.tzinfo is not None, 'Evidence timestamp needs a timezone')
    require(dt.timedelta(minutes=-5) <= dt.datetime.now(dt.timezone.utc)-stamp <= dt.timedelta(hours=hours), 'Evidence expired or is in the future')


def read_json(path):
    path = Path(path)
    require(path.is_file() and not path.is_symlink(), 'Evidence must be a regular file')
    return json.loads(path.read_text(encoding='utf-8-sig'))


def command(args, **kwargs):
    # Never echo command stderr: external tools may include private host details.
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            text=True, timeout=600, **kwargs)
    require(result.returncode == 0, 'External verification command failed')
    return result.stdout


def gh(path):
    return json.loads(command(['gh', 'api', 'repos/'+REPO+'/'+path]))


def check_ci(release, build_run):
    pr = gh('pulls/230')
    require(pr['state'] == 'open' and pr['head']['sha'] == release and pr['head']['ref'] == BRANCH, 'PR 230 head changed or is closed')
    runs = gh('actions/runs?head_sha='+release+'&per_page=100')['workflow_runs']
    for workflow in WORKFLOWS:
        matches = [r for r in runs if r['path'] == '.github/workflows/'+workflow and r['event'] == 'pull_request']
        require(matches, 'Missing CI: '+workflow)
        latest = max(matches, key=lambda r: (r['run_number'], r['run_attempt']))
        require(latest['status'] == 'completed' and latest['conclusion'] == 'success', 'CI incomplete or failed: '+workflow)
    checks = gh('commits/'+release+'/check-runs?per_page=100')['check_runs']
    require(checks and all(c['status'] == 'completed' and c['conclusion'] == 'success' for c in checks), 'A source check is incomplete or not successful')
    build = gh('actions/runs/'+str(build_run))
    require(build['head_sha'] == release and build['path'] == '.github/workflows/offhost-build-artifact.yml' and build['conclusion'] == 'success', 'Exact off-host build is not successful')
    return {'workflows': len(WORKFLOWS), 'checks': len(checks), 'buildRun': build_run}


def verify_artifact(directory, release, expected):
    verifier = Path(__file__).parent/'ops/verify-offhost-runtime-bundle.py'
    spec = importlib.util.spec_from_file_location('signature_bundle_verifier', verifier)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    count = module.verify(Path(directory), release)
    archive = Path(directory)/('fcarena-runtime-'+release+'.tar.gz')
    require(digest(archive) == expected, 'Artifact differs from accepted rehearsal bytes')
    return {'archiveSha256': expected, 'members': count}


def acceptance(evidence, release):
    require(evidence['release'] == release and evidence['status'] == 'PASS', 'Final integrated acceptance is incomplete')
    fresh(evidence['verifiedAtUtc'])
    require(re.fullmatch('[0-9a-f]{64}', evidence['artifactSha256']), 'Missing accepted artifact checksum')
    for gate in GATES:
        item = evidence['gates'].get(gate, {})
        require(item.get('status') == 'PASS' and item.get('evidenceSha256') and item.get('verifiedAtUtc'), 'Acceptance missing: '+gate)
        require(re.fullmatch('[0-9a-f]{64}', item['evidenceSha256']), 'Invalid evidence checksum: '+gate)
        source = Path(item['evidenceFile'])
        require(source.is_file() and not source.is_symlink() and digest(source) == item['evidenceSha256'], 'Evidence bytes changed: '+gate)
        fresh(item['verifiedAtUtc'])
    return evidence['artifactSha256']


def approval(path, evidence_path, release, artifact, baseline):
    value = read_json(path)
    require(value.get('approvedBy') == 'owner' and value.get('action') == 'ACTIVATE_SIGNATURE_WEB_API', 'Explicit owner activation approval required')
    require(value.get('release') == release and value.get('artifactSha256') == artifact and value.get('baselineRelease') == baseline, 'Owner approval does not cover exact candidate/artifact/baseline')
    require(value.get('acceptanceSha256') == digest(evidence_path), 'Acceptance changed after owner approval')
    fresh(value['approvedAtUtc'])
    return value


REMOTE_PREFLIGHT = r'''
import datetime as dt,hashlib,json,pathlib,shutil,subprocess,urllib.request
P=pathlib.Path
current=json.loads(P('/etc/fcarena/managed-release/current.json').read_text())
assert current['release']==request['baseline'],'Live release changed'
rollback=json.loads((P(current['runtime']).parent/'managed-rollback.private.json').read_text())['previousManaged']
assert rollback['release']!=current['release']
for state in [current,rollback]:
 for name in ['apps/api/dist/main.js','apps/api/prisma/schema.prisma','apps/web/.next/BUILD_ID']:
  assert (P(state['runtime'])/name).is_file(),'Protected runtime is incomplete'
for port,kind in [(4000,'api'),(4001,'api'),(3000,'web'),(3001,'web')]:
 with urllib.request.urlopen('http://127.0.0.1:'+str(port)+('/api/health' if kind=='api' else '/web-release'),timeout=15) as response:
  data=json.load(response)
 assert (data['data']['runtime']['release'] if kind=='api' else data['release'])==request['baseline']
assert shutil.disk_usage('/').free>=12*1024**3,'Storage preflight failed'
backup=json.loads(P('/var/lib/fcarena-backup-state/health.json').read_text())
assert backup['encrypted'] and backup['unavailableProviderAssets']==0
now=dt.datetime.now(dt.timezone.utc)
for key,hours in [('lastLocalBackupAt',30),('lastOffhostCopyAt',24),('lastVerifiedRestoreAt',24)]:
 assert dt.timedelta(minutes=-5)<=now-dt.datetime.fromisoformat(backup[key])<=dt.timedelta(hours=hours),'Recovery proof expired'
managed=P('/opt/fcarena-ops/release/managed_runtime.py')
assert hashlib.sha256(managed.read_bytes()).hexdigest()==request['managedSha256'],'Managed activation tool changed'
print(json.dumps({'status':'PASS','release':current['release'],'rollback':rollback['release'],'replicas':4,'freeBytes':shutil.disk_usage('/').free}))
'''

REMOTE_APPLY = r'''
import hashlib,importlib.util,json,pathlib,subprocess
P=pathlib.Path
runtime=P(request['runtime'])
assert not runtime.is_symlink() and runtime.resolve()==runtime
assert runtime.name=='runtime' and runtime.parent.parent==P('/opt/fcarena-deployments')
source=P('/opt/fcarena-ops/release/managed_runtime.py')
assert hashlib.sha256(source.read_bytes()).hexdigest()==request['managedSha256']
spec=importlib.util.spec_from_file_location('managed',source);managed=importlib.util.module_from_spec(spec);spec.loader.exec_module(managed)
# A separately prepared, root-owned staging proof is mandatory. No copied
# production media, migration, build or extraction is performed by this tool.
proof=managed.require_staging_proof(runtime.parent/'staging-proof.json',runtime,request['release'],request['baseline'])
assert proof['artifactSha256']==request['artifactSha256']
assert proof['acceptanceSha256']==request['acceptanceSha256']
assert proof['ownerApprovalSha256']==request['ownerApprovalSha256']
args=['python3',str(source),'activate','--runtime',str(runtime),'--sha',request['release'],'--expected-old',request['baseline'],'--staging-proof',str(runtime.parent/'staging-proof.json')]
subprocess.run(args,check=True,timeout=600,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
print(json.dumps({'status':'PASS','release':request['release'],'productionActivated':True}))
'''


def remote(args, code, request):
    require(re.fullmatch(r'[A-Za-z0-9_.@:-]+', args.host), 'Invalid SSH host')
    script = 'request='+repr(request)+'\n'+code
    return json.loads(command(['ssh', '-T', '-i', str(args.identity), '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', args.host, 'python3 -'], input=script))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument('--preflight', action='store_true')
    modes.add_argument('--apply', action='store_true')
    parser.add_argument('--release', required=True)
    parser.add_argument('--baseline', required=True)
    parser.add_argument('--artifact-dir', type=Path, required=True)
    parser.add_argument('--build-run', type=int, required=True)
    parser.add_argument('--evidence', type=Path, required=True)
    parser.add_argument('--host', required=True)
    parser.add_argument('--identity', type=Path, required=True)
    parser.add_argument('--managed-sha256', required=True)
    parser.add_argument('--runtime', help='Existing isolated, verified runtime on production host; apply only')
    parser.add_argument('--owner-approval', type=Path, help='Separately issued exact owner approval; apply only')
    args = parser.parse_args(argv)
    activation_attempted = False
    try:
        require(all(re.fullmatch('[0-9a-f]{40}', s) for s in [args.release, args.baseline]), 'Full immutable source revisions required')
        require(args.release != args.baseline, 'Candidate is already live')
        require(re.fullmatch('[0-9a-f]{64}', args.managed_sha256), 'Pinned managed tool checksum required')
        evidence = read_json(args.evidence)
        artifact = acceptance(evidence, args.release)
        bundle = verify_artifact(args.artifact_dir, args.release, artifact)
        ci = check_ci(args.release, args.build_run)
        request = {'release': args.release, 'baseline': args.baseline, 'artifactSha256': artifact,
                   'managedSha256': args.managed_sha256, 'acceptanceSha256': digest(args.evidence)}
        baseline = remote(args, REMOTE_PREFLIGHT, request)
        if args.preflight:
            print(json.dumps({'status': 'PASS', 'productionActivated': False, 'artifact': bundle, 'ci': ci, 'baseline': baseline}))
            return 0
        require(args.owner_approval and args.runtime, 'Apply requires separate owner approval and an existing verified runtime')
        approval(args.owner_approval, args.evidence, args.release, artifact, args.baseline)
        runtime = PurePosixPath(args.runtime)
        require(runtime.is_absolute() and runtime.name == 'runtime' and str(runtime.parent.parent) == '/opt/fcarena-deployments' and '..' not in runtime.parts, 'Invalid runtime path')
        request.update(runtime=str(runtime), ownerApprovalSha256=digest(args.owner_approval))
        activation_attempted = True
        print(json.dumps(remote(args, REMOTE_APPLY, request)))
        return 0
    except Blocked as error:
        print(json.dumps({'status': 'BLOCKED', 'productionActivated': 'unknown' if activation_attempted else False, 'reason': str(error)}))
        return 2
    except (KeyError, ValueError, OSError, subprocess.SubprocessError, tarfile.TarError):
        # No credentials, provider responses, environment files or private data.
        print(json.dumps({'status': 'BLOCKED', 'productionActivated': 'unknown' if activation_attempted else False,
                          'reason': 'Required exact acceptance, artifact, CI, recovery, baseline or owner approval gate failed.'}))
        return 2


if __name__ == '__main__':
    sys.exit(main())

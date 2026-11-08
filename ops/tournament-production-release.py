#!/usr/bin/env python3
"""VCCL-only isolated build/test and reversible activation. Never migrates production."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tarfile
import time
import urllib.request

LIVE = Path('/opt/fcarena')
BASE = Path('/opt/fcarena-deployments/tournament-20261108')
SOURCE = BASE / 'source'
CHECKS = BASE / 'checks.json'

def command(args, *, env=None, cwd=None, input=None):
    return subprocess.check_output(args, cwd=cwd, env=env, input=input, stderr=subprocess.PIPE)

def save(path, data):
    path.write_text(json.dumps(data, indent=2))

def step(name, args, env, cwd=SOURCE):
    print('START', name, flush=True)
    with (BASE / (name + '.log')).open('w') as log:
        result = subprocess.run(args, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT)
    checks = json.loads(CHECKS.read_text()) if CHECKS.exists() else {}
    checks[name] = {'exitCode': result.returncode, 'at': time.time()}
    save(CHECKS, checks)
    if result.returncode:
        print((BASE / (name + '.log')).read_text()[-14000:], flush=True)
        raise RuntimeError(name + ' failed')
    print('PASS', name, flush=True)

def postgres():
    info = json.loads(command(['docker', 'inspect', 'fc-arena-postgres']))[0]
    values = dict(v.split('=', 1) for v in info['Config']['Env'] if '=' in v)
    return values['POSTGRES_USER']

def sql(text):
    return command(['docker', 'exec', '-i', 'fc-arena-postgres', 'psql', '-U', postgres(), '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input=text.encode())

def test_env():
    return {**os.environ, **json.loads((BASE / 'test-env.json').read_text())}

def prepare(release):
    BASE.mkdir(exist_ok=True, mode=0o700)
    os.chmod(BASE, 0o700)
    SOURCE.mkdir(exist_ok=True)
    with tarfile.open(BASE / 'source.tar.gz') as archive:
        archive.extractall(SOURCE, filter='data')
    # Reuse the installed, matching dependencies. Source and build outputs are isolated.
    for relative in ['node_modules', 'apps/api/node_modules', 'apps/web/node_modules']:
        link = SOURCE / relative
        if not link.exists():
            link.symlink_to(LIVE / relative, target_is_directory=True)
    if (SOURCE / 'apps/api/prisma/schema.prisma').read_text() != (LIVE / 'apps/api/prisma/schema.prisma').read_text():
        raise RuntimeError('Schema changed: this release intentionally forbids production migrations')
    for filename in ['.env.local', '.env.production.local', '.env.production']:
        if (LIVE / 'apps/web' / filename).exists():
            shutil.copy2(LIVE / 'apps/web' / filename, SOURCE / 'apps/web' / filename)
            os.chmod(SOURCE / 'apps/web' / filename, 0o600)
    if not (BASE / 'test-env.json').exists():
        password = secrets.token_hex(24)
        sql("CREATE ROLE fcarena_tournament_test LOGIN PASSWORD '" + password + "';\nCREATE DATABASE fcarena_tournament_20261108_test OWNER fcarena_tournament_test;")
        env = {'DATABASE_URL': 'postgresql://fcarena_tournament_test:' + password + '@127.0.0.1:5433/fcarena_tournament_20261108_test',
               'JWT_ACCESS_SECRET': secrets.token_hex(32), 'JWT_REFRESH_SECRET': secrets.token_hex(32),
               'NODE_ENV': 'test', 'REDIS_HOST': '127.0.0.1', 'REDIS_PORT': '6381',
               'AI_ASSISTANT_ENABLED': 'false', 'PUSH_ENABLED': 'false', 'FIXTURE_DAY_REMINDERS_ENABLED': 'false',
               'REGISTRATION_NOTIFICATIONS_ENABLED': 'false', 'TOURNAMENT_REPORT_EXPORT_CLEANUP_ENABLED': 'false',
               'CARD_EXPORT_CLEANUP_ENABLED': 'false', 'ARENA_MEDIA_CLEANUP_ENABLED': 'false', 'OCR_RETENTION_CLEANUP_ENABLED': 'false'}
        save(BASE / 'test-env.json', env)
        os.chmod(BASE / 'test-env.json', 0o600)
    existing = command(['docker', 'ps', '-a', '--format', '{{.Names}}']).decode().splitlines()
    if 'fcarena-tournament-test-redis' not in existing:
        command(['docker', 'run', '-d', '--name', 'fcarena-tournament-test-redis', '-p', '127.0.0.1:6381:6379', 'redis:7-alpine'])
    else:
        command(['docker', 'start', 'fcarena-tournament-test-redis'])
    env = test_env()
    if not env['DATABASE_URL'].endswith('/fcarena_tournament_20261108_test'):
        raise RuntimeError('Refusing to reset any database except the fixed disposable test database')
    # Several legacy suites intentionally leave fixtures behind. Every complete
    # release gate starts from a fresh database owned by the isolated test role.
    sql('DROP DATABASE fcarena_tournament_20261108_test WITH (FORCE);\nCREATE DATABASE fcarena_tournament_20261108_test OWNER fcarena_tournament_test;')
    step('prisma-migrate-test', ['npm', 'exec', '--', 'prisma', 'migrate', 'deploy'], env, SOURCE / 'apps/api')
    step('api-build', ['npm', 'run', 'build:api'], env)
    step('api-unit', ['npm', 'run', 'test', '--workspace=apps/api', '--', '--maxWorkers=2'], env)
    step('api-e2e', ['npm', 'run', 'test:e2e', '--workspace=apps/api', '--', '--maxWorkers=1'], env)
    web_env = {**os.environ, 'NODE_ENV': 'production', 'NODE_OPTIONS': '--max-old-space-size=1600',
               'FC_ARENA_RELEASE_SHA': release, 'NEXT_PUBLIC_FC_ARENA_RELEASE_SHA': release,
               'VERCEL_GIT_COMMIT_SHA': release, 'NEXT_DEPLOYMENT_ID': release[:32]}
    step('web-build', ['npm', 'run', 'build', '--workspace=apps/web', '--', '--webpack'], web_env)
    save(BASE / 'prepared.json', {'release': release, 'productionSchemaChanged': False})
    print('READY FOR ACTIVATION', release, flush=True)

def health(url):
    with urllib.request.urlopen(url, timeout=15) as response:
        return json.load(response)

def activate(release):
    if json.loads((BASE / 'prepared.json').read_text())['release'] != release:
        raise RuntimeError('Release does not match the tested build')
    checks = json.loads(CHECKS.read_text())
    for name in ['prisma-migrate-test', 'api-build', 'api-unit', 'api-e2e', 'web-build']:
        if checks.get(name, {}).get('exitCode') != 0:
            raise RuntimeError('Missing passing gate: ' + name)
    # Check the exact normalized source snapshot again before overwriting any live file.
    before = json.loads((BASE / 'source-before/source-manifest.json').read_text())
    desired = json.loads((BASE / 'source-manifest.json').read_text())
    changed = [p for p, digest in desired.items() if before.get(p) != digest]
    for name in changed:
        target = LIVE / name
        if target.exists():
            raw = target.read_bytes()
            if b'\0' not in raw: raw = raw.replace(b'\r\n', b'\n')
            if hashlib.sha256(raw).hexdigest() != before.get(name):
                raise RuntimeError('Concurrent server source change: ' + name)
        elif name in before:
            raise RuntimeError('Concurrent server source deletion: ' + name)
    rollback = BASE / 'rollback'
    rollback.mkdir(mode=0o700, exist_ok=False)
    for name in changed:
        if (LIVE / name).exists():
            target = rollback / 'files' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(LIVE / name, target)
    # A custom-format DB backup is retained, and its table of contents is verified.
    db_name = command(['node', '--input-type=module', '-e', "import fs from 'node:fs';import dotenv from 'dotenv';let e=dotenv.parse(fs.readFileSync('apps/api/.env'));console.log(new URL(e.DATABASE_URL).pathname.slice(1));"], cwd=LIVE).decode().strip()
    with (rollback / 'database.dump').open('wb') as dump:
        subprocess.run(['docker', 'exec', 'fc-arena-postgres', 'pg_dump', '-U', postgres(), '-Fc', db_name], stdout=dump, check=True)
    command(['docker', 'exec', '-i', 'fc-arena-postgres', 'pg_restore', '-l'], input=(rollback / 'database.dump').read_bytes())
    (rollback / 'database.dump.sha256').write_text(hashlib.sha256((rollback / 'database.dump').read_bytes()).hexdigest() + '\n')
    # Exercise a complete restore in an isolated database before service promotion.
    restore_db = 'fcarena_tournament_rollback_test'
    sql('CREATE DATABASE ' + restore_db + ' OWNER fcarena_tournament_test;')
    command(['docker', 'exec', '-i', 'fc-arena-postgres', 'pg_restore', '-U', postgres(), '-d', restore_db, '--no-owner', '--no-privileges'], input=(rollback / 'database.dump').read_bytes())
    save(rollback / 'restore-verification.json', {'database': restore_db, 'restored': True, 'productionDatabaseChanged': False})
    save(rollback / 'previous-health.json', health('https://api.fcarena.in/api/health'))
    for service in ['api', 'web']:
        command(['systemctl', 'is-active', '--quiet', 'fcarena-' + service])
    # Keep previous hashed static assets available to clients already running the old build.
    for path in (LIVE / 'apps/web/.next/static').rglob('*'):
        target = SOURCE / 'apps/web/.next/static' / path.relative_to(LIVE / 'apps/web/.next/static')
        if path.is_file() and not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
    save(rollback / 'changed-files.json', changed)
    (BASE / 'release.env').write_text('FC_ARENA_RELEASE_SHA=' + release + '\n')
    os.chmod(BASE / 'release.env', 0o600)
    save(BASE / 'activation.json', {'release': release, 'state': 'activating'})
    command(['systemctl', 'stop', 'fcarena-api', 'fcarena-web'])
    try:
        for app, artifact in [('api', 'dist'), ('web', '.next')]:
            shutil.move(LIVE / 'apps' / app / artifact, rollback / (app + '-build'))
            owner = (rollback / (app + '-build')).stat()
            target = LIVE / 'apps' / app / artifact
            shutil.move(SOURCE / 'apps' / app / artifact, target)
            for directory, _, files in os.walk(target):
                os.chown(directory, owner.st_uid, owner.st_gid)
                for filename in files: os.chown(Path(directory) / filename, owner.st_uid, owner.st_gid)
        for name in changed:
            target = LIVE / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(SOURCE / name, target)
        for service in ['api', 'web']:
            dropin = Path('/etc/systemd/system/fcarena-' + service + '.service.d/zzzz-tournament-production.conf')
            if dropin.exists():
                shutil.copy2(dropin, rollback / (service + '-dropin'))
            dropin.write_text('[Service]\nEnvironmentFile=' + str(BASE / 'release.env') + '\n')
        command(['systemctl', 'daemon-reload'])
        command(['systemctl', 'start', 'fcarena-api', 'fcarena-web'])
        for attempt in range(30):
            try:
                api = health('https://api.fcarena.in/api/health')
                web = health('https://fcarena.in/web-release')
                if api['data']['status'] == 'healthy' and api['data']['runtime']['release'] == release and web['release'] == release:
                    save(BASE / 'activation.json', {'state': 'healthy', 'release': release, 'api': api, 'web': web, 'rollback': str(rollback)})
                    print('PRODUCTION HEALTHY', release, flush=True)
                    return
            except Exception:
                pass
            time.sleep(2)
        raise RuntimeError('Public release health verification failed')
    except Exception:
        restore()
        raise

def restore():
    rollback = BASE / 'rollback'
    command(['systemctl', 'stop', 'fcarena-api', 'fcarena-web'])
    for app, artifact in [('api', 'dist'), ('web', '.next')]:
        target = LIVE / 'apps' / app / artifact
        backup = rollback / (app + '-build')
        if backup.exists():
            if target.exists(): shutil.move(target, BASE / (app + '-failed-build'))
            shutil.copytree(backup, target)
    for name in json.loads((rollback / 'changed-files.json').read_text()):
        target = LIVE / name
        if (rollback / 'files' / name).exists(): shutil.copy2(rollback / 'files' / name, target)
        elif target.exists(): target.unlink()
    for service in ['api', 'web']:
        dropin = Path('/etc/systemd/system/fcarena-' + service + '.service.d/zzzz-tournament-production.conf')
        if (rollback / (service + '-dropin')).exists(): shutil.copy2(rollback / (service + '-dropin'), dropin)
        elif dropin.exists(): dropin.unlink()
    command(['systemctl', 'daemon-reload'])
    command(['systemctl', 'start', 'fcarena-api', 'fcarena-web'])
    save(BASE / 'activation.json', {'state': 'rolled-back'})
    print('ROLLED BACK', flush=True)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['prepare', 'activate', 'rollback'])
    parser.add_argument('--release', default='')
    args = parser.parse_args()
    if command(['hostname']).decode().strip() != 'fcarena-prod' or '45.129.87.8' not in command(['hostname', '-I']).decode():
        raise SystemExit('Refusing to run outside VCCLHosting 45.129.87.8')
    if args.action != 'rollback' and (len(args.release) != 40 or any(c not in '0123456789abcdef' for c in args.release)):
        raise SystemExit('A full lowercase Git release SHA is required')
    if args.action == 'prepare': prepare(args.release)
    elif args.action == 'activate': activate(args.release)
    else: restore()

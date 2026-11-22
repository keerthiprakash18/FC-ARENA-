#!/usr/bin/env python3
"""One managed runtime pointer, two app instances, retained reversible baseline."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import time
import urllib.request

MANAGED=Path('/etc/fcarena/managed-release')
LIVE_CWD=Path('/opt/fcarena/apps/api')
SECONDARY_FLAGS=['PUSH_ENABLED','FIXTURE_DAY_REMINDERS_ENABLED','REGISTRATION_NOTIFICATIONS_ENABLED',
 'AUTH_RATE_LIMIT_CLEANUP_ENABLED','TOURNAMENT_REPORT_EXPORT_CLEANUP_ENABLED','CARD_EXPORT_CLEANUP_ENABLED',
 'ARENA_MEDIA_CLEANUP_ENABLED','OCR_RETENTION_CLEANUP_ENABLED','OCR_WORKER_ENABLED']
PORTS={'api':{'primary':4000,'secondary':4001},'web':{'primary':3000,'secondary':3001}}
UNITS=['fcarena-api','fcarena-api-secondary','fcarena-web','fcarena-web-secondary']
def command(args,timeout=180):return subprocess.check_output(args,stderr=subprocess.PIPE,timeout=timeout).decode().strip()
def property(unit,key):return command(['systemctl','show',unit,'--property='+key,'--value'])
def save(path,value,mode=0o600):
    temporary=path.with_name(path.name+'.partial')
    temporary.write_text(json.dumps(value,indent=2));temporary.chmod(mode);temporary.replace(path)
def environment(unit):
    pid=int(property(unit,'MainPID'));assert pid>0
    return dict(row.split('=',1) for row in Path('/proc',str(pid),'environ').read_text().split('\0') if '=' in row)
def encode_environment(values):
    rows=[]
    ignored={'INVOCATION_ID','JOURNAL_STREAM','SYSTEMD_EXEC_PID','NOTIFY_SOCKET','LISTEN_PID','LISTEN_FDS','LISTEN_FDNAMES'}
    for name,value in sorted(values.items()):
        if name in ignored:continue
        assert re.fullmatch('[A-Za-z_][A-Za-z0-9_]*',name) and '\0' not in value
        rows.append(name+'="'+value.replace('\\','\\\\').replace('"','\\"')+'"\n')
    return ''.join(rows)
def release_health(port,component):
    path='/api/health' if component=='api' else '/web-release'
    with urllib.request.urlopen(f'http://127.0.0.1:{port}'+path,timeout=10) as response:data=json.load(response)
    if component=='web':return data['release']
    assert data['success'] and data['data']['database']=='connected' and data['data']['redis']=='connected'
    return data['data']['runtime']['release']
def wait_all(sha):
    for attempt in range(45):
        try:
            if all(release_health(port,kind)==sha for kind,roles in PORTS.items() for port in roles.values()):return
        except Exception:pass
        time.sleep(2)
    raise RuntimeError('Managed replicas failed exact release health')

def require_schema_parity(previous,runtime):
    def files(root):
        folder=root/'apps/api/prisma'
        return {file.relative_to(folder).as_posix():file.read_bytes().replace(b'\r\n',b'\n')
          for file in folder.rglob('*') if file.is_file() and (file.name=='schema.prisma' or file.name=='migration.sql')}
    old,new=files(previous),files(runtime)
    assert old and old==new,'Schema changes require a separate approved migration rehearsal'
def launcher(component,role):
    current=json.loads((MANAGED/'current.json').read_text());runtime=Path(current['runtime']).resolve();sha=current['release']
    assert re.fullmatch('[0-9a-f]{40}',sha) and runtime.parent.parent==Path('/opt/fcarena-deployments') and runtime.name=='runtime'
    env=dict(os.environ,NODE_ENV='production',FC_ARENA_RELEASE_SHA=sha,FC_ARENA_INSTANCE_ROLE=role,FC_ARENA_INSTANCE_ID=component+'-'+role)
    if component=='api':
        os.chdir(LIVE_CWD);env.update(PORT=str(PORTS['api'][role]),HOST='127.0.0.1')
        if role=='secondary':env.update({key:'false' for key in SECONDARY_FLAGS})
        argv=['/usr/bin/node',str(runtime/'apps/api/dist/main.js')]
    else:
        os.chdir(runtime/'apps/web');env.update(VERCEL_GIT_COMMIT_SHA=sha,GITHUB_SHA=sha,NEXT_DEPLOYMENT_ID=sha[:32])
        argv=['/usr/bin/node',str(runtime/'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p',str(PORTS['web'][role])]
    os.execve(argv[0],argv,env)
def managed_override_name(names):
    count=max([len(re.match('z*',name).group()) for name in names]+[0])+1
    name='z'*count+'-managed.conf';assert len(name)<=255 and all(name>old for old in names)
    return name
def dropin(unit):
    names=[Path(raw).name for raw in property(unit,'DropInPaths').split()]
    name=managed_override_name(names)
    target=Path('/etc/systemd/system')/(unit+'.service.d')/name;assert not target.exists();return target
def service(component,role,cache):
    user='fcarena-'+component
    memory='1280M' if component=='api' else '768M';high='768M' if component=='api' else '384M'
    rw='/var/lib/fcarena/storage /opt/fcarena/storage/match-results /opt/fcarena/apps/api/storage /opt/fcarena/apps/api/uploads' if component=='api' else str(cache)
    cwd=LIVE_CWD.as_posix() if component=='api' else cache.parent.parent.as_posix()
    return f'''[Unit]
Description=FC Arena {component} {role} managed runtime
After=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=20
[Service]
User={user}
Group={user}
WorkingDirectory={cwd}
EnvironmentFile=
EnvironmentFile={MANAGED}/{component}.env
ExecStart=
ExecStart=/usr/bin/python3 /opt/fcarena-ops/release/managed_runtime.py launch --component {component} --role {role}
Restart=always
RestartSec=2
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths={rw}
MemoryHigh={high}
MemoryMax={memory}
CPUWeight={'300' if component=='api' else '200'}
LimitNOFILE=65536
Slice=fcarena-app.slice
[Install]
WantedBy=multi-user.target
'''
def proxy_changes(path,text):
    updated=text.replace('http://127.0.0.1:3000','http://fcarena_web_runtime').replace('http://127.0.0.1:4000','http://fcarena_api_runtime')
    # Connection failure is bounded; non-idempotent writes are never replayed
    # after an upstream has accepted them (non_idempotent is NOT enabled).
    if path.name in ['fcarena-api','fcarena-auth.conf','fcarena-api.conf']:
        updated=re.sub(r'proxy_connect_timeout\s+\d+s;', 'proxy_connect_timeout 2s;',updated)
    return updated

def disabled_override_path(target,index):
    return target.with_name('managed-rollback-'+str(index)+'-'+str(time.time_ns())+'.disabled')

def verify_public_replicas(sha,probe=None,sleep=time.sleep):
    def public_health():
        with urllib.request.urlopen('https://api.fcarena.in/api/health',timeout=10) as response:return json.load(response)
    probe=probe or public_health;seen=set()
    # Nginx reload is asynchronous. Old workers may briefly continue routing to
    # the original primary while new workers load both upstreams.
    for attempt in range(60):
        body=probe();assert body['data']['runtime']['release']==sha
        seen.add(body['data']['runtime']['instance'])
        if seen=={'api-primary','api-secondary'}:return seen
        sleep(0.25)
    raise AssertionError('Both API replicas must actually serve public traffic')
UPSTREAMS='''upstream fcarena_api_runtime {
    least_conn;
    server 127.0.0.1:4000 max_fails=1 fail_timeout=3s;
    server 127.0.0.1:4001 max_fails=1 fail_timeout=3s;
    keepalive 16;
}
upstream fcarena_web_runtime {
    least_conn;
    server 127.0.0.1:3000 max_fails=1 fail_timeout=3s;
    server 127.0.0.1:3001 max_fails=1 fail_timeout=3s;
    keepalive 16;
}
'''
def restore(snapshot):
    if snapshot.get('previousManaged'):
        save(MANAGED/'current.json',snapshot['previousManaged'],0o644)
        for raw,content in snapshot.get('unitFiles',{}).items():Path(raw).write_text(content)
        command(['systemctl','daemon-reload'])
        for unit in UNITS:command(['systemctl','restart',unit])
        wait_all(snapshot['oldApiRelease']);return
    for raw,content in snapshot['nginx'].items():Path(raw).write_text(content)
    upstream=Path('/etc/nginx/conf.d/fcarena-managed-upstreams.conf')
    if upstream.exists():upstream.rename(upstream.with_name(upstream.name+'.disabled-'+str(time.time_ns())))
    for index,raw in enumerate(snapshot['managedDropins']):
        target=Path(raw)
        if target.exists():target.rename(disabled_override_path(target,index))
    command(['systemctl','daemon-reload'])
    for unit in ['fcarena-api-secondary','fcarena-web-secondary']:
        subprocess.run(['systemctl','disable','--now',unit],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    command(['systemctl','restart','fcarena-api']);command(['systemctl','restart','fcarena-web'])
    command(['nginx','-t']);command(['systemctl','reload','nginx'])
    for attempt in range(45):
        try:
            if release_health(4000,'api')==snapshot['oldApiRelease'] and release_health(3000,'web')==snapshot['oldWebRelease']:return
        except Exception:pass
        time.sleep(2)
    raise RuntimeError('Baseline rollback failed exact release health')
def activate(args):
    import pwd
    assert os.geteuid()==0 and socket.gethostname().split('.')[0]=='fcarena-prod'
    assert re.fullmatch('[0-9a-f]{40}',args.sha or '')
    runtime=Path(args.runtime).resolve();assert runtime.name=='runtime' and runtime.parent.parent==Path('/opt/fcarena-deployments')
    previous=json.loads((MANAGED/'current.json').read_text()) if (MANAGED/'current.json').exists() else None
    # A preparation failure before installing the primary overrides never
    # switched production. Resume only this exact candidate with both old
    # markers and original ExecStarts still intact; never treat it as deployed.
    if previous and previous['release']==args.sha and previous['runtime']==str(runtime):
        assert release_health(4000,'api')==args.expected_old and release_health(3000,'web')==args.expected_old
        assert all('managed_runtime.py' not in property('fcarena-'+kind,'ExecStart') for kind in ['api','web'])
        previous=None
    proof=json.loads(Path(args.staging_proof).read_text());assert proof['release']==args.sha and proof['crossInstanceRedis'] and proof['replicaFailover'] and proof['realBrowser']
    backup=json.loads(Path('/var/lib/fcarena-backup-state/health.json').read_text())
    assert backup['encrypted'] and backup.get('lastOffhostCopyAt') and backup.get('lastVerifiedRestoreAt')
    now=dt.datetime.now(dt.timezone.utc)
    for key,hours in [('lastLocalBackupAt',30),('lastOffhostCopyAt',48),('lastVerifiedRestoreAt',192)]:
        assert dt.timedelta(minutes=-5)<=now-dt.datetime.fromisoformat(backup[key])<=dt.timedelta(hours=hours),'Recovery proof is stale'
    assert backup['unavailableProviderAssets']==0
    old_web=Path(property('fcarena-web','WorkingDirectory'))
    require_schema_parity(old_web.parents[1],runtime)
    assert release_health(4000,'api')==args.expected_old and release_health(3000,'web')==args.expected_old
    old_env={component:environment('fcarena-'+component) for component in ['api','web']}
    assert all(values.get('NODE_ENV')=='production' for values in old_env.values())
    assert shutil.disk_usage(runtime).free>3*1024**3
    MANAGED.mkdir(mode=0o755,parents=True,exist_ok=True)
    ops=Path('/opt/fcarena-ops/release');ops.mkdir(mode=0o755,parents=True,exist_ok=True)
    if Path(__file__).resolve()!=ops/'managed_runtime.py':shutil.copyfile(Path(__file__),ops/'managed_runtime.py')
    (ops/'managed_runtime.py').chmod(0o644)
    cache=runtime/'apps/web/.next/cache';cache.mkdir(exist_ok=True)
    owner=pwd.getpwnam('fcarena-web');os.chown(cache,owner.pw_uid,owner.pw_gid)
    if previous:
        assert previous['release']==args.expected_old
        unit_files={}
        replacements={}
        for component in ['api','web']:
            primary=[Path(raw) for raw in property('fcarena-'+component,'DropInPaths').split() if raw.endswith('-managed.conf')]
            assert len(primary)==1
            secondary=Path('/etc/systemd/system')/('fcarena-'+component+'-secondary.service')
            for target,role in [(primary[0],'primary'),(secondary,'secondary')]:
                unit_files[str(target)]=target.read_text();replacements[target]=service(component,role,cache)
        snapshot={'previousManaged':previous,'oldApiRelease':args.expected_old,'unitFiles':unit_files}
        save(runtime.parent/'managed-rollback.private.json',snapshot)
        try:
            for target,content in replacements.items():target.write_text(content)
            save(MANAGED/'current.json',{'runtime':str(runtime),'release':args.sha},0o644)
            command(['systemctl','daemon-reload'])
            for unit in UNITS:command(['systemctl','restart',unit])
            wait_all(args.sha)
            print('MANAGED_DUAL_API_WEB_UPDATE=PASS');return
        except BaseException:restore(snapshot);raise
    for component,values in old_env.items():
        if component=='api':values.update(API_RATE_LIMIT_STORAGE='redis',API_RATE_LIMIT_READS_PER_MINUTE='12000',MATCH_REALTIME_REDIS_ENABLED='true',BACKUP_HEALTH_FILE='/var/lib/fcarena-backup-state/health.json')
        target=MANAGED/(component+'.env');encoded=encode_environment(values)
        if target.exists():assert target.read_text()==encoded,'Prepared environment changed; inspect before resuming'
        else:target.write_text(encoded);target.chmod(0o600)
    save(MANAGED/'current.json',{'runtime':str(runtime),'release':args.sha},0o644)
    for file in (old_web/'.next/static').rglob('*'):
        if not file.is_file():continue
        target=runtime/'apps/web/.next/static'/file.relative_to(old_web/'.next/static')
        if target.exists():
            assert hashlib.file_digest(file.open('rb'),'sha256').digest()==hashlib.file_digest(target.open('rb'),'sha256').digest()
        else:target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(file,target)
    paths=[Path('/etc/nginx/sites-available/fcarena-web'),Path('/etc/nginx/sites-available/fcarena-api'),Path('/etc/nginx/snippets/fcarena-auth.conf'),Path('/etc/nginx/snippets/fcarena-api.conf')]
    snapshot={'oldApiRelease':release_health(4000,'api'),'oldWebRelease':release_health(3000,'web'),
      'nginx':{str(path):path.read_text() for path in paths},'managedDropins':[]}
    assert snapshot['oldApiRelease']==args.expected_old and snapshot['oldWebRelease']==args.expected_old
    slice_file=Path('/etc/systemd/system/fcarena-app.slice')
    slice_content='[Unit]\nDescription=FC Arena bounded application memory budget\n[Slice]\nMemoryAccounting=yes\nMemoryHigh=2300M\nMemoryMax=2800M\nMemorySwapMax=512M\n'
    if slice_file.exists():assert slice_file.read_text()==slice_content
    else:slice_file.write_text(slice_content)
    for component in ['api','web']:
        primary=dropin('fcarena-'+component);snapshot['managedDropins'].append(str(primary));primary.write_text(service(component,'primary',cache));primary.chmod(0o644)
        secondary=Path('/etc/systemd/system')/('fcarena-'+component+'-secondary.service')
        if secondary.exists():
            assert property('fcarena-'+component+'-secondary','MainPID')=='0' and secondary.read_text()==service(component,'secondary',cache),'Only identical inactive candidate units may resume'
        else:secondary.write_text(service(component,'secondary',cache));secondary.chmod(0o644)
    save(runtime.parent/'managed-rollback.private.json',snapshot)
    try:
        command(['systemctl','daemon-reload'])
        for unit in UNITS:command(['systemctl','restart',unit])
        wait_all(args.sha)
        critical=['DATABASE_URL','REDIS_URL','REDIS_PASSWORD','JWT_ACCESS_SECRET','JWT_REFRESH_SECRET','CLOUDINARY_URL','CLOUDINARY_API_SECRET','BREVO_API_KEY','OCR_UPLOAD_DIR','ARENA_MEDIA_DIR']
        for component,previous in old_env.items():
            current=environment('fcarena-'+component)
            assert all(previous.get(key)==current.get(key) for key in critical),'Critical environment parity failed'
        for path in paths:path.write_text(proxy_changes(path,snapshot['nginx'][str(path)]))
        upstream=Path('/etc/nginx/conf.d/fcarena-managed-upstreams.conf');assert not upstream.exists();upstream.write_text(UPSTREAMS)
        command(['nginx','-t']);command(['systemctl','reload','nginx'])
        seen=verify_public_replicas(args.sha)
        for kind in ['api','web']:
            command(['systemctl','enable','fcarena-'+kind+'-secondary'])
        save(runtime.parent/'managed-release-evidence.json',{'status':'PASS','release':args.sha,'apiInstances':2,'webInstances':2,'workerRole':'primary only',
          'environmentParity':True,'backupHealthConfigured':True,'publicApiInstancesSeen':sorted(seen),'activatedAt':dt.datetime.now(dt.timezone.utc).isoformat()})
        print('MANAGED_DUAL_API_WEB_ACTIVATION=PASS')
    except BaseException:restore(snapshot);raise
def main():
    import fcntl
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['launch','activate','rollback']);parser.add_argument('--component',choices=['api','web']);parser.add_argument('--role',choices=['primary','secondary']);parser.add_argument('--runtime');parser.add_argument('--sha');parser.add_argument('--expected-old');parser.add_argument('--staging-proof');args=parser.parse_args()
    if args.action=='launch':launcher(args.component,args.role);return
    assert os.geteuid()==0
    with open('/run/lock/fcarena-release.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        if args.action=='activate':activate(args)
        else:restore(json.loads((Path(args.runtime).parent/'managed-rollback.private.json').read_text()))
if __name__=='__main__':main()

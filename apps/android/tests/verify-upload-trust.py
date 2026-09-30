import os, subprocess, tempfile, zipfile, shutil
from pathlib import Path

def run(args):
    return subprocess.run(args,text=True,capture_output=True)
with tempfile.TemporaryDirectory() as root:
    root=Path(root)
    os.environ['FC_ARENA_STORE_PASSWORD']='local-fixture-password'
    for alias in ('upload','other'):
        r=run(['keytool','-genkeypair','-alias',alias,'-keystore',str(root/(alias+'.jks')),'-storepass:env','FC_ARENA_STORE_PASSWORD','-keyalg','RSA','-keysize','2048','-validity','3650','-dname','CN=Temporary Test'])
        assert r.returncode==0,r.stderr
    original=root/'signed.aab'
    with zipfile.ZipFile(original,'w') as z:z.writestr('base/dex/classes.dex',b'fixture payload')
    r=run(['jarsigner','-keystore',str(root/'upload.jks'),'-storepass:env','FC_ARENA_STORE_PASSWORD',str(original),'upload'])
    assert r.returncode==0,r.stdout+r.stderr
    legacy=run(['jarsigner','-verify','-strict',str(original)])
    assert legacy.returncode!=0,'Expected original trust failure'
    def verify(path,alias='upload'):
        return run(['jarsigner','-verify','-strict','-keystore',str(root/(alias+'.jks')),'-storepass:env','FC_ARENA_STORE_PASSWORD',str(path),alias])
    assert verify(original).returncode==0
    reordered=root/'manifest-last.aab'
    with zipfile.ZipFile(original) as src,zipfile.ZipFile(reordered,'w') as dst:
        for name in sorted(src.namelist(),key=lambda n:n=='META-INF/MANIFEST.MF'):dst.writestr(name,src.read(name))
    assert verify(reordered).returncode==0
    tampered=root/'tampered.aab'
    with zipfile.ZipFile(original) as src,zipfile.ZipFile(tampered,'w') as dst:
        for name in src.namelist():dst.writestr(name,b'changed' if name=='base/dex/classes.dex' else src.read(name))
    assert verify(tampered).returncode!=0
    extra=root/'unsigned-entry.aab';shutil.copyfile(original,extra)
    with zipfile.ZipFile(extra,'a') as z:z.writestr('base/unsigned.txt',b'added')
    assert verify(extra).returncode!=0
    assert verify(original,'other').returncode!=0
    print('PASS: reproduces old trust failure; accepts verified self-signed key and manifest-last archive; rejects tampering, unsigned additions and wrong key.')

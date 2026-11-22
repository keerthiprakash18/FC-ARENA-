import { describe,expect,it } from 'vitest';
import { assessBackupHealth } from './backup-health.js';
describe('honest encrypted recovery freshness',()=>{
  const now=Date.parse('2026-11-22T12:00:00Z');
  const state={encrypted:true,lastLocalBackupAt:'2026-11-22T10:00:00Z',lastOffhostCopyAt:'2026-11-22T11:00:00Z',lastVerifiedRestoreAt:'2026-11-20T12:00:00Z',latestCopied:true,unavailableProviderAssets:0};
  it('requires actual local, off-host and restored recovery evidence',()=>{
    expect(assessBackupHealth(state,now).status).toBe('healthy');
    for(const key of ['lastLocalBackupAt','lastOffhostCopyAt','lastVerifiedRestoreAt'])expect(assessBackupHealth({...state,[key]:null},now).status).toBe('degraded');
  });
  it('does not treat encryption or checksums alone as a verified restore',()=>{
    expect(assessBackupHealth({...state,lastVerifiedRestoreAt:'2026-11-01T00:00:00Z'},now).status).toBe('degraded');
    expect(assessBackupHealth({...state,lastOffhostCopyAt:'2030-01-01T00:00:00Z'},now).status).toBe('degraded');
    expect(assessBackupHealth({...state,unavailableProviderAssets:1},now).status).toBe('degraded');
  });
});

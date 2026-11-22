export function assessBackupHealth(state: Record<string, unknown>, now = Date.now()) {
  const age = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const stamp = Date.parse(value);
    return Number.isFinite(stamp) && stamp <= now + 300000 ? Math.max(0, now-stamp)/3600000 : null;
  };
  const localAgeHours=age(state.lastLocalBackupAt),offhostAgeHours=age(state.lastOffhostCopyAt),restoreAgeHours=age(state.lastVerifiedRestoreAt);
  const encrypted=state.encrypted===true;
  const healthy=encrypted && localAgeHours!==null && localAgeHours<=30 && offhostAgeHours!==null && offhostAgeHours<=48 &&
    restoreAgeHours!==null && restoreAgeHours<=8*24 && state.unavailableProviderAssets===0;
  return { configured:true,status:healthy?'healthy':'degraded',encrypted,
    localAgeHours:localAgeHours===null?null:Number(localAgeHours.toFixed(2)),
    offhostAgeHours:offhostAgeHours===null?null:Number(offhostAgeHours.toFixed(2)),
    restoreAgeHours:restoreAgeHours===null?null:Number(restoreAgeHours.toFixed(2)),
    latestCopied:state.latestCopied===true,providerAssetsComplete:state.unavailableProviderAssets===0,
  };
}

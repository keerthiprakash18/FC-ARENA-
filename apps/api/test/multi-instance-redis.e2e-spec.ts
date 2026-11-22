import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { MatchRealtimeService } from '../src/matches/match-realtime.service.js';
import { AuthRateLimitService } from '../src/auth/auth-rate-limit.service.js';

describe('cross-instance Redis budgets and match updates',()=>{
  const streams=[new MatchRealtimeService(),new MatchRealtimeService()];
  const sql=vi.fn().mockRejectedValue(new Error('Global budgets must not write PostgreSQL in healthy Redis mode'));
  const counters=[new AuthRateLimitService({$queryRaw:sql} as never),new AuthRateLimitService({$queryRaw:sql} as never)];
  beforeAll(async()=>{
    const db=new URL(process.env.DATABASE_URL ?? '');
    const redis=process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : process.env.REDIS_HOST;
    if(process.env.NODE_ENV!=='test'||!db.pathname.endsWith('_test')||!['localhost','127.0.0.1','[::1]'].includes(db.hostname)||!['localhost','127.0.0.1','[::1]'].includes(redis ?? '')) throw Error('Disposable loopback PostgreSQL/Redis required');
    vi.stubEnv('MATCH_REALTIME_REDIS_ENABLED','true');vi.stubEnv('API_RATE_LIMIT_STORAGE','redis');vi.stubEnv('AUTH_RATE_LIMIT_CLEANUP_ENABLED','false');
    await Promise.all(streams.map(service=>service.onModuleInit()));
    for(const service of counters) service.onModuleInit();
    await vi.waitFor(()=>{for(const service of counters) expect((service as any).apiRedis.status).toBe('ready');});
  },15000);
  afterAll(()=>{for(const service of [...streams,...counters]) service.onModuleDestroy();vi.unstubAllEnvs();});
  it('delivers a match event once on both instances, even without local listeners on the writer',async()=>{
    const match=randomUUID(),received=vi.fn();
    const stop=streams[1].subscribe(match,received);
    streams[0].publish(match,'result_confirmed',{score:2});
    await vi.waitFor(()=>expect(received).toHaveBeenCalledOnce());
    expect(received.mock.calls[0][0]).toMatchObject({matchId:match,type:'result_confirmed',data:{score:2}});
    stop();streams[0].publish(match,'another');
    await new Promise(resolve=>setTimeout(resolve,30));expect(received).toHaveBeenCalledOnce();
  });
  it('shares one atomic quota across concurrent requests on two app instances',async()=>{
    const key='audit-'+randomUUID();
    const results=await Promise.allSettled(Array.from({length:20},(_,i)=>counters[i%2].consume('API_IP',key,5,1000)));
    expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(5);
    for(const row of results) if(row.status==='rejected') expect(row.reason).toMatchObject({status:429});
    expect(sql).not.toHaveBeenCalled();
    await new Promise(resolve=>setTimeout(resolve,1100));
    await expect(counters[1].consume('API_IP',key,5,1000)).resolves.toBeUndefined();
  });
});

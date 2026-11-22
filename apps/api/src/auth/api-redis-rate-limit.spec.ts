import { afterEach,describe,expect,it,vi } from 'vitest';
import { AuthRateLimitService } from './auth-rate-limit.service.js';
afterEach(()=>vi.useRealTimers());
describe('optional global Redis acceleration',()=>{
  function setup(){
    const prisma={$queryRaw:vi.fn().mockResolvedValue([{attemptCount:1}])};
    const service=new AuthRateLimitService(prisma as never);
    const redis={eval:vi.fn().mockResolvedValue(1),disconnect:vi.fn()};
    (service as any).apiRedis=redis;return{service,prisma,redis};
  }
  it('never turns a Redis quota rejection into a successful database fallback',async()=>{
    const{service,prisma,redis}=setup();redis.eval.mockResolvedValue(1201);
    await expect(service.consume('API_IP','client',1200,60000)).rejects.toMatchObject({status:429});
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
  it('keeps account/authentication budgets persistent in PostgreSQL',async()=>{
    const{service,prisma,redis}=setup();await service.consume('LOGIN_IP','client',10,60000);
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();expect(redis.eval).not.toHaveBeenCalled();
  });
  it('falls back atomically on Redis failure without retrying every request during an outage',async()=>{
    const{service,prisma,redis}=setup();redis.eval.mockRejectedValue(new Error('offline'));
    await service.consume('API_IP','client',1200,60000);await service.consume('API_IP','client',1200,60000);
    expect(redis.eval).toHaveBeenCalledOnce();expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});

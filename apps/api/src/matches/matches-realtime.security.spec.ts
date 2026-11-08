import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { MatchesController } from './matches.controller.js';
import { MatchesService } from './matches.service.js';

const settle=async()=>{for(let i=0;i<14;i++)await Promise.resolve();};
afterEach(()=>vi.useRealTimers());
async function stream(){
  vi.useFakeTimers();const request=Object.assign(new EventEmitter(),{user:{sub:'user'}});
  const response=Object.assign(new EventEmitter(),{writableEnded:false,writableLength:0,
    status:vi.fn(),setHeader:vi.fn(),flushHeaders:vi.fn(),write:vi.fn(),
    end:vi.fn(function(this:{writableEnded:boolean}){this.writableEnded=true;})});
  let listener:(event:unknown)=>void=()=>{};const unsubscribe=vi.fn();
  const realtime={subscribe:vi.fn((_id:string,callback:(event:unknown)=>void)=>{listener=callback;return unsubscribe;})};
  const matches={assertRealtimeAccess:vi.fn().mockResolvedValue(undefined)};
  const guard={authenticateRequest:vi.fn().mockResolvedValue(true)};
  await new MatchesController(matches as never,realtime as never,guard as never)
    .streamMatchEvents(request as never,response as never,'match');
  return{request,response,matches,guard,unsubscribe,publish:(event:unknown)=>listener(event)};
}
describe('Long-lived match stream authorization',()=>{
  it('rechecks authentication and league scope before delivering each private result',async()=>{
    const s=await stream();s.publish({type:'result_submitted',data:{homeScore:3}});await settle();
    expect(s.guard.authenticateRequest).toHaveBeenCalledTimes(1);
    expect(s.matches.assertRealtimeAccess).toHaveBeenCalledTimes(2);
    expect(s.response.write).toHaveBeenCalledWith(expect.stringContaining('"homeScore":3'));
    s.response.emit('close');expect(vi.getTimerCount()).toBe(0);
  });
  it('closes a revoked or expired session without exposing the next event',async()=>{
    const s=await stream();s.guard.authenticateRequest.mockRejectedValue(new UnauthorizedException());
    s.publish({type:'result_submitted',data:{homeScore:99}});await settle();
    expect(s.response.write).toHaveBeenCalledTimes(1);expect(s.unsubscribe).toHaveBeenCalledTimes(1);
    expect(s.response.writableEnded).toBe(true);expect(vi.getTimerCount()).toBe(0);
  });
  it('closes the stream when league membership is removed',async()=>{
    const s=await stream();s.matches.assertRealtimeAccess.mockRejectedValue(new ForbiddenException());
    s.publish({type:'private-result'});await settle();
    expect(s.response.write).toHaveBeenCalledTimes(1);expect(s.response.writableEnded).toBe(true);
  });
  it('revalidates idle sessions on heartbeats and fails closed on storage errors',async()=>{
    const s=await stream();s.guard.authenticateRequest.mockRejectedValue(new Error('Storage unavailable'));
    await vi.advanceTimersByTimeAsync(20000);
    expect(s.response.writableEnded).toBe(true);expect(s.unsubscribe).toHaveBeenCalledTimes(1);
  });
  it('bounds queued events and releases subscriptions after disconnect',async()=>{
    const s=await stream();s.guard.authenticateRequest.mockImplementation(()=>new Promise(()=>{}));
    for(let i=0;i<40;i++)s.publish({type:'burst'});
    expect(s.response.writableEnded).toBe(true);expect(s.unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);s.request.emit('aborted');expect(s.unsubscribe).toHaveBeenCalledTimes(1);
  });
  it('checks membership with a small projection instead of loading all rosters',async()=>{
    const db={match:{findUnique:vi.fn().mockResolvedValue({tournament:{leagueId:'league'}})},
      leagueMember:{findUnique:vi.fn().mockResolvedValue({id:'member'})}};
    const service=new MatchesService(db as never,{} as never);await service.assertRealtimeAccess('user','match');
    expect(db.match.findUnique).toHaveBeenCalledWith({where:{id:'match'},select:{tournament:{select:{leagueId:true}}}});
    db.leagueMember.findUnique.mockResolvedValue(null as never);
    await expect(service.assertRealtimeAccess('user','match')).rejects.toMatchObject({status:403});
  });
});

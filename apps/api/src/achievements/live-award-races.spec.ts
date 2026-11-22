import { describe,expect,it,vi } from 'vitest';
import { AchievementsService } from './achievements.service.js';
describe('bounded complete award race pages',()=>{
  function setup(){
    const prisma={leagueMember:{findMany:vi.fn().mockResolvedValue([{leagueId:'league'}])},
      tournament:{findMany:vi.fn().mockResolvedValue(Array.from({length:6},(_,i)=>({id:'cup-'+(i+6),name:'Cup '+i}))),count:vi.fn().mockResolvedValue(17)}};
    const service=new AchievementsService(prisma as never,{} as never);
    const race=vi.spyOn(service,'getTournamentAwardRaces').mockResolvedValue({success:true,data:{available:true},error:null} as never);
    return{prisma,service,race};
  }
  it('makes older competitions reachable and reports exact page offsets',async()=>{
    const{prisma,service}=setup();const result=await service.getLiveAwardRaces('member',6,6);
    expect(result.data.pagination).toEqual({offset:6,limit:6,total:17,nextOffset:12});
    expect(result.data.races[0].tournament.id).toBe('cup-6');
    expect(prisma.tournament.findMany).toHaveBeenCalledWith(expect.objectContaining({skip:6,take:6,where:expect.objectContaining({leagueId:{in:['league']}})}));
  });
  it('retains successful races and exposes failures without leaking upstream errors',async()=>{
    const{service,race}=setup();race.mockRejectedValueOnce(new Error('private provider detail'));
    const result=await service.getLiveAwardRaces('member');
    expect(result.data.races).toHaveLength(5);expect(result.data.failed).toEqual([{tournamentId:'cup-6'}]);
    expect(JSON.stringify(result)).not.toContain('private provider');
  });
  it('never reads races outside membership and avoids queries for accounts without leagues',async()=>{
    const{prisma,service,race}=setup();prisma.leagueMember.findMany.mockResolvedValue([]);
    expect((await service.getLiveAwardRaces('outsider')).data.races).toEqual([]);
    expect(prisma.tournament.findMany).not.toHaveBeenCalled();expect(race).not.toHaveBeenCalled();
  });
});

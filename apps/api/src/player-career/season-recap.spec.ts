import { describe, expect, it, vi } from 'vitest';
import { PlayerCareerService } from './player-career.service.js';

describe('Official season recap truth boundary',()=>{
  it('filters confirmed career matches to published season period and eligible tournament scope',async ()=>{
    const seasonId='s1';
    const match=(id:string,confirmedAt:string,tournamentId:string,leagueId:string,outcome:'W'|'D'|'L',goals:number)=>({
      id,confirmedAt,outcome,teamGoalsFor:goals,teamGoalsAgainst:1,
      tournament:{id:tournamentId,name:'Tournament',league:{id:leagueId}},
    });
    const prisma={
      ballonSeason:{findMany:vi.fn().mockResolvedValue([{
        id:seasonId,name:'Arena 2026',startAt:new Date('2026-01-01T00:00:00Z'),
        endAt:new Date('2026-12-31T23:59:59Z'),status:'LOCKED',
        eligibleLeagueIds:[],eligibleTournamentIds:['t1'],
      }])},
      ballonFinalRanking:{findMany:vi.fn().mockResolvedValue([{seasonId,rank:5}])},
    };
    const service=new PlayerCareerService(prisma as never);
    vi.spyOn(service,'getMyCareer').mockResolvedValue({ data:{ matchHistory:[
      match('a','2026-06-12T12:00:00Z','t1','l1','W',2),
      match('b','2026-07-12T12:00:00Z','t2','l2','L',1),
      match('c','2025-06-12T12:00:00Z','t1','l1','W',3),
    ] } } as never);
    const result=await service.getMySeasonRecaps('u');
    expect(result.data.recaps[0]).toMatchObject({
      matches:1,wins:1,losses:0,teamGoalsFor:2,teamGoalsAgainst:1,
      officialRank:5,statsBasis:'CONFIRMED_RESULTS',goalBasis:'TEAM_SIDE_GOALS',
    });
  });
});

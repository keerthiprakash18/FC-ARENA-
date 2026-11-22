import { describe,expect,it } from 'vitest';
import { chronologicalLeagueForm, type FormFixture } from './league-recent-form.js';
function fixture(id:string,tournamentId:string,day:number,homeScore:number,awayScore:number):FormFixture {
  return {id,tournamentId,homeRegistrationId:'home-'+tournamentId,awayRegistrationId:'away-'+id,status:'COMPLETED',phase:'STAGE',sequence:day,
    tournament:{competitionFormat:'LEAGUE_ROUND_ROBIN',legType:'SINGLE',duoAggregateEnabled:false},
    homeRegistration:{members:[{userId:'player'}]},awayRegistration:{members:[{userId:'opponent'}]},
    match:{status:'COMPLETED',confirmedResultSubmissionId:'result-'+id,confirmedResult:{id:'result-'+id,status:'CONFIRMED',homeScore,awayScore,
      reviewedAt:new Date(`2026-11-${String(day).padStart(2,'0')}T12:00:00Z`),createdAt:new Date('2026-01-01'),duoGames:null,statEvents:[]}},
  };
}
describe('league form from confirmed chronological facts',()=>{
  it('interleaves tournaments by confirmation time and returns only the latest five',()=>{
    const data=[fixture('a','cup-a',1,2,0),fixture('c','cup-a',3,1,1),fixture('e','cup-a',5,0,1),
      fixture('b','cup-b',2,0,1),fixture('d','cup-b',4,2,0),fixture('f','cup-b',6,3,0)];
    expect(chronologicalLeagueForm(data,new Set(['player'])).get('player')).toBe('LDWLW');
  });
  it('ignores stale result links and duplicate fixtures and preserves who originally played',()=>{
    const valid=fixture('valid','cup',1,2,0);
    valid.match!.confirmedResult!.statEvents=[{payload:{home:{userIds:['original']},away:{userIds:['opponent']}}}];
    valid.homeRegistration!.members=[{userId:'replacement'}];
    const stale=fixture('stale','cup',2,0,3);stale.match!.confirmedResultSubmissionId='not-current';
    const duplicate={...valid,id:'duplicate'};
    const forms=chronologicalLeagueForm([stale,valid,duplicate],new Set(['original','replacement']));
    expect(forms.get('original')).toBe('W');expect(forms.has('replacement')).toBe(false);
  });
  it('records individual verified DUO games rather than the aggregate team outcome',()=>{
    const duo=fixture('duo','cup',1,4,3);duo.tournament.duoAggregateEnabled=true;
    duo.match!.confirmedResult!.duoGames=[
      {homePlayerId:'player',awayPlayerId:'opponent',homeGoals:0,awayGoals:2},
      {homePlayerId:'partner',awayPlayerId:'other',homeGoals:4,awayGoals:1},
    ];
    expect(chronologicalLeagueForm([duo],new Set(['player','partner'])).get('player')).toBe('L');
  });
});

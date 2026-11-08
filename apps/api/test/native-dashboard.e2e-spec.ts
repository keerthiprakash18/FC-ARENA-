import 'reflect-metadata';
import {randomUUID} from 'node:crypto';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {PrismaService} from '../src/database/prisma.service.js';
import {AuthorizationService} from '../src/security/authorization.service.js';
import {LeaguesService} from '../src/leagues/leagues.service.js';
import {PlayerDashboardService} from '../src/player-career/player-dashboard.service.js';
import type {PlayerCareerService} from '../src/player-career/player-career.service.js';

describe('Native Home tournament context and registration totals on real data',()=>{
 const run=randomUUID().slice(0,8),owner=randomUUID(),outsider=randomUUID();let db:PrismaService,service:PlayerDashboardService,cups:string[],pending:string;
 beforeAll(async()=>{
  const url=new URL(process.env.DATABASE_URL??'');
  if(process.env.NODE_ENV!=='test'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw Error('Disposable loopback *_test database required');
  db=new PrismaService();await db.$connect();
  for(const [i,id]of [owner,outsider].entries())await db.user.create({data:{id,email:`native-${run}-${i}@example.invalid`,fullName:'Native test',passwordHash:'not-a-login-hash',status:'ACTIVE'}});
  cups=[];
  for(let i=0;i<2;i++){
   const league=await db.league.create({data:{name:i?'KICKOFF FC test':'FC ARENA TAMIL test',code:`NW${run}${i}`,creatorUserId:owner}});
   await db.leagueMember.create({data:{userId:owner,leagueId:league.id,type:i?'SECONDARY':'PRIMARY'}});
   const cup=await db.tournament.create({data:{name:'International Friendlies',code:`NW-T-${run}${i}`,leagueId:league.id,createdByUserId:owner,mode:'SOLO',format:'ROUND_ROBIN',teamSize:1,maxEntries:48,status:'REGISTRATION_OPEN',registrationMode:'APPROVAL'}});cups.push(cup.id);
   await db.tournamentRegistration.createMany({data:Array.from({length:i?35:1},(_,n)=>({tournamentId:cup.id,registeredByUserId:owner,entryName:`Native team ${i}-${n}`,status:'APPROVED'}))});
  }
  pending=(await db.tournamentRegistration.create({data:{tournamentId:cups[1],registeredByUserId:owner,entryName:'Pending team',status:'PENDING'}})).id;
  for(const status of ['REJECTED','WITHDRAWN']as const)await db.tournamentRegistration.create({data:{tournamentId:cups[1],registeredByUserId:owner,entryName:status,status}});
  const leagues=new LeaguesService(db,null as never,new AuthorizationService(db));
  service=new PlayerDashboardService(db,leagues,{getMyCareer:async()=>({data:{profile:{},lifetimeStatistics:{},tournamentHistory:[],matchHistory:[]}})}as unknown as PlayerCareerService);
 },60000);
 afterAll(async()=>{await db?.$disconnect();});
 it('returns separate 1 and 36 totals for identically named tournaments in two leagues',async()=>{
  const rows=(await service.getSummary(owner)).data.tournaments;
  expect(rows.find(t=>t.id===cups[0])).toMatchObject({approvedEntries:1,pendingEntries:0,registeredEntries:1});
  expect(rows.find(t=>t.id===cups[1])).toMatchObject({approvedEntries:35,pendingEntries:1,registeredEntries:36});
 });
 it('updates the approval breakdown without changing the registered total',async()=>{
  await db.tournamentRegistration.update({where:{id:pending},data:{status:'APPROVED'}});
  expect((await service.getSummary(owner)).data.tournaments.find(t=>t.id===cups[1])).toMatchObject({approvedEntries:36,pendingEntries:0,registeredEntries:36});
 });
 it('never exposes either league to an account without membership',async()=>{
  expect((await service.getSummary(outsider)).data.tournaments).toEqual([]);
 });
});

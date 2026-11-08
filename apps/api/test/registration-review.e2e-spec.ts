import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaModule } from '../src/database/prisma.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { SecurityModule } from '../src/security/security.module.js';
import { AuthorizationService } from '../src/security/authorization.service.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { NotificationsModule } from '../src/notifications/notifications.module.js';
import { RegistrationNotificationsService } from '../src/notifications/registration-notifications.service.js';
import { TournamentsService } from '../src/tournaments/tournaments.service.js';
import { TournamentsController } from '../src/tournaments/tournaments.controller.js';
import { FixturesService } from '../src/tournaments/fixtures.service.js';
import { GroupFixturesService } from '../src/tournaments/group-fixtures.service.js';
import { TournamentGroupsService } from '../src/tournaments/tournament-groups.service.js';
import { PlayoffsService } from '../src/tournaments/playoffs.service.js';
import { TournamentLogoService } from '../src/tournaments/tournament-logo.service.js';
import { TournamentToolsService } from '../src/tournaments/tournament-tools.service.js';
import { TournamentFixtureResetService } from '../src/tournaments/tournament-fixture-reset.service.js';
import { TournamentDrawRestartService } from '../src/tournaments/tournament-draw-restart.service.js';
import { configureHttpSecurity } from '../src/security/http-security.js';
import { LeaguesController } from '../src/leagues/leagues.controller.js';
import { LeaguesService } from '../src/leagues/leagues.service.js';
import { LeagueManagementService } from '../src/leagues/league-management.service.js';
import { LeagueLogoService } from '../src/leagues/league-logo.service.js';

describe('Registration lists and scoped league-manager review over authenticated HTTP', () => {
  const run=randomUUID().slice(0,8), users=Array.from({length:11},()=>randomUUID());
  const [owner,creator,reviewer,limited,fixtureAdmin,player,otherOwner,teammate,superAdmin,newPlayer,participantAdmin]=users;
  let app:INestApplication,db:PrismaService,authorization:AuthorizationService,notifier:RegistrationNotificationsService;
  let leagues:string[],cups:string[],pendingId:string;
  function token(id:string) { return new JwtService().sign({sub:id,email:'review@example.invalid',role:id===superAdmin?'SUPER_ADMIN':'USER',type:'access'}, {secret:process.env.JWT_ACCESS_SECRET,expiresIn:600}); }
  const get=(id:string,path:string)=>request(app.getHttpServer()).get('/api'+path).set('Authorization','Bearer '+token(id));
  const post=(id:string,path:string,body:object={})=>request(app.getHttpServer()).post('/api'+path).set('Authorization','Bearer '+token(id)).send(body);
  const registrations=(id:string)=>get(id,`/tournaments/${cups[1]}/registrations`);
  const list=(id:string,index=1)=>get(id,`/leagues/${leagues[index]}/tournaments`);
  beforeAll(async()=>{
    const url=new URL(process.env.DATABASE_URL??'');
    if(process.env.NODE_ENV!=='test'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!url.pathname.endsWith('_test')) throw Error('Disposable loopback *_test database required');
    process.env.JWT_ACCESS_SECRET='review-access-'+run;process.env.JWT_REFRESH_SECRET='review-refresh-'+run;process.env.PUSH_ENABLED='false';
    const module=await Test.createTestingModule({imports:[PrismaModule,SecurityModule,AuthModule,NotificationsModule],controllers:[TournamentsController,LeaguesController],providers:[TournamentsService,LeaguesService,LeagueManagementService,{provide:LeagueLogoService,useValue:{}},
      ...[FixturesService,GroupFixturesService,TournamentGroupsService,PlayoffsService,TournamentLogoService,TournamentToolsService,TournamentFixtureResetService,TournamentDrawRestartService].map(provide=>({provide,useValue:{}})),
    ]}).compile();
    app=module.createNestApplication();configureHttpSecurity(app);await app.init();db=app.get(PrismaService);authorization=app.get(AuthorizationService);notifier=app.get(RegistrationNotificationsService);
    for(const [index,id] of users.entries())await db.user.create({data:{id,email:`review-${run}-${index}@example.invalid`,fullName:`Review Test ${index}`,passwordHash:'not-a-login-hash',role:id===superAdmin?'SUPER_ADMIN':'USER',status:'ACTIVE',player:{create:{playerCode:`RV-${run}-${index}`,identity:{create:{inGameName:`Review ${index}`,inGameNameNormalized:`review ${index}`,isVerified:true}}}}}});
    leagues=[];cups=[];
    for(let i=0;i<2;i++){
      const league=await db.league.create({data:{name:i?'Kickoff test':'Arena Tamil test',code:`RV${run}${i}`,creatorUserId:i?owner:otherOwner}});leagues.push(league.id);
      await db.leagueMember.createMany({data:users.map(userId=>({userId,leagueId:league.id,type:i?'SECONDARY':'PRIMARY'}))});
      const cup=await db.tournament.create({data:{name:'International Friendlies',code:`RV-T-${run}${i}`,leagueId:league.id,createdByUserId:i?creator:otherOwner,mode:'SOLO',format:'ROUND_ROBIN',teamSize:1,maxEntries:48,status:'REGISTRATION_OPEN',registrationMode:'APPROVAL'}});cups.push(cup.id);
    }
    await db.leagueAdmin.createMany({data:[{leagueId:leagues[1],userId:owner,role:'OWNER'},{leagueId:leagues[0],userId:otherOwner,role:'OWNER'}, {leagueId:leagues[1],userId:creator,role:'ADMIN',permissions:['MANAGE_TOURNAMENTS']},{leagueId:leagues[1],userId:reviewer,role:'ADMIN',permissions:['MANAGE_TOURNAMENTS']},{leagueId:leagues[1],userId:limited,role:'ADMIN',permissions:['MANAGE_MEMBERS']} ]});
    await db.tournamentAdmin.createMany({data:[{tournamentId:cups[1],userId:fixtureAdmin,role:'ADMIN',permissions:['MANAGE_FIXTURES']},{tournamentId:cups[1],userId:participantAdmin,role:'ADMIN',permissions:['MANAGE_PARTICIPANTS']}]});
    for(let i=0;i<19;i++)await db.tournamentRegistration.create({data:{tournamentId:cups[1],registeredByUserId:creator,entryName:`Approved ${i}`,status:'APPROVED'}});
    for(const userId of [player,teammate,fixtureAdmin]){
      const entry=await db.tournamentRegistration.create({data:{tournamentId:cups[1],registeredByUserId:userId,entryName:'Pending '+userId,status:'PENDING',members:{create:{tournamentId:cups[1],userId}}}});if(userId===player)pendingId=entry.id;
    }
    for(const status of ['REJECTED','WITHDRAWN'] as const)await db.tournamentRegistration.create({data:{tournamentId:cups[1],registeredByUserId:creator,status}});
  },60000);
  afterAll(async()=>{await app?.close();});
  it('returns approved, pending and registered totals separately for identically named cups in different leagues',async()=>{
    const empty=await list(reviewer,0),busy=await list(reviewer);
    expect(empty.status).toBe(200);expect(busy.status).toBe(200);
    expect(empty.body.data.tournaments[0]).toMatchObject({id:cups[0],approvedEntries:0,pendingEntries:0,registeredEntries:0,canManageParticipants:false});
    expect(busy.body.data.tournaments[0]).toMatchObject({id:cups[1],approvedEntries:19,pendingEntries:3,registeredEntries:22,canManageParticipants:true});
  });
  it('keeps the list permission flag identical to real detail and review access for every role',async()=>{
    for(const [id,allowed] of [[owner,true],[creator,true],[reviewer,true],[participantAdmin,true],[superAdmin,true],[limited,false],[fixtureAdmin,false],[player,false],[otherOwner,false]] as const){
      const row=(await list(id)).body.data.tournaments.find((t:any)=>t.id===cups[1]);
      expect(row.canManageParticipants).toBe(allowed);
      expect((await get(id,`/tournaments/${cups[1]}`)).body.data.tournament.canManageParticipants).toBe(allowed);
      expect((await registrations(id)).status).toBe(allowed?200:403);
    }
  });
  it('grants registration review without granting settings, score verification, admin assignment or cross-league review',async()=>{
    expect(await authorization.canManageTournament(reviewer,cups[1])).toBe(true);
    for(const permission of ['MANAGE_SETTINGS','VERIFY_SCORES','MANAGE_FIXTURES'] as const)expect(await authorization.hasTournamentPermission(reviewer,cups[1],permission)).toBe(false);
    expect(await authorization.canManageTournamentAdmins(reviewer,cups[1])).toBe(false);
    expect((await list(reviewer)).body.data.tournaments[0].canManageSettings).toBe(false);
    expect((await list(owner)).body.data.tournaments[0].canManageSettings).toBe(true);
    expect((await get(reviewer,`/tournaments/${cups[0]}/registrations`)).status).toBe(403);
    expect((await post(limited,`/tournaments/${cups[1]}/registrations/${pendingId}/approve`)).status).toBe(403);
    expect((await db.tournamentRegistration.findUniqueOrThrow({where:{id:pendingId}})).status).toBe('PENDING');
  });
  it('notifies the same league managers who can actually review registrations',async()=>{
    await notifier.notify(pendingId);
    const notices=await db.notification.findMany({where:{entityId:pendingId,type:'TOURNAMENT_REGISTRATION_RECEIVED'},select:{userId:true}});
    expect(notices.map(n=>n.userId).sort()).toEqual([owner,creator,reviewer,participantAdmin].sort());
    await notifier.notify(pendingId);expect(await db.notification.count({where:{entityId:pendingId,type:'TOURNAMENT_REGISTRATION_RECEIVED'}})).toBe(4);
  });
  it('registers a player, lets a non-creator league manager approve, updates counts and preserves the single entry on repeat review',async()=>{
    const response=await post(newPlayer,`/tournaments/${cups[1]}/register`,{inGameName:'Review 9',entryName:'HTTP new entry'});
    expect(response.status).toBe(201);const id=response.body.data.registration.id;
    expect((await list(reviewer)).body.data.tournaments[0]).toMatchObject({approvedEntries:19,pendingEntries:4,registeredEntries:23});
    expect((await post(reviewer,`/tournaments/${cups[1]}/registrations/${id}/approve`)).status).toBe(201);
    expect((await get(newPlayer,`/tournaments/${cups[1]}/my-registration`)).body.data.registration.status).toBe('APPROVED');
    expect((await list(reviewer)).body.data.tournaments[0]).toMatchObject({approvedEntries:20,pendingEntries:3,registeredEntries:23});
    expect((await post(reviewer,`/tournaments/${cups[1]}/registrations/${id}/approve`)).status).toBe(409);
    expect(await db.tournamentRegistration.count({where:{id}})).toBe(1);
    expect(await db.notification.count({where:{entityId:id,userId:newPlayer,type:'TOURNAMENT_APPLICATION_APPROVED'}})).toBe(1);
  });
  it('requires authentication and refuses cross-account fields in registration requests',async()=>{
    expect((await request(app.getHttpServer()).get(`/api/leagues/${leagues[1]}/tournaments`)).status).toBe(401);
    expect((await post(newPlayer,`/tournaments/${cups[1]}/register`,{inGameName:'Review 9',entryName:'Injected',userId:owner})).status).toBe(400);
  });
  it('exposes member-review capability independently of league settings and tournament permissions',async()=>{
    for(const [id,canManageMembers,canManageSettings] of [[owner,true,true],[limited,true,false],[reviewer,false,false],[player,false,false],[superAdmin,true,true]] as const){
      const response=await get(id,`/leagues/${leagues[1]}`);expect(response.status).toBe(200);
      expect(response.body.data.league).toMatchObject({canManageMembers,canManageSettings});
      expect((await get(id,`/leagues/${leagues[1]}/applications`)).status).toBe(canManageMembers?200:403);
    }
  });
  it('allows a member manager to approve an actual join request and retains the two-league limit',async()=>{
    const applicant=randomUUID();await db.user.create({data:{id:applicant,email:`join-${run}@example.invalid`,fullName:'New league applicant',passwordHash:'not-a-login-hash',status:'ACTIVE'}});
    const pending=await db.leagueApplication.create({data:{leagueId:leagues[1],userId:applicant,status:'PENDING'}});
    expect((await get(limited,`/leagues/${leagues[1]}`)).body.data.league.pendingApplications).toBe(1);
    expect((await post(reviewer,`/leagues/${leagues[1]}/applications/${pending.id}/approve`)).status).toBe(403);
    expect((await post(limited,`/leagues/${leagues[1]}/applications/${pending.id}/approve`)).status).toBe(201);
    expect(await db.leagueMember.count({where:{leagueId:leagues[1],userId:applicant}})).toBe(1);
    expect((await get(limited,`/leagues/${leagues[1]}/applications`)).body.data.applications).toHaveLength(0);
    expect((await post(limited,`/leagues/${leagues[1]}/applications/${pending.id}/approve`)).status).toBe(409);
    const third=await db.league.create({data:{name:'Third limit test',code:'LIM'+run,creatorUserId:owner}});
    const blocked=await db.leagueApplication.create({data:{leagueId:third.id,userId:player,status:'PENDING'}});
    await db.leagueAdmin.create({data:{leagueId:third.id,userId:owner,role:'OWNER'}});
    expect((await post(owner,`/leagues/${third.id}/applications/${blocked.id}/approve`)).status).toBe(409);
    expect(await db.leagueMember.count({where:{userId:player}})).toBe(2);
    expect((await db.leagueApplication.findUniqueOrThrow({where:{id:blocked.id}})).status).toBe('PENDING');
  });
});

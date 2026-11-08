import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaModule } from '../src/database/prisma.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { configureHttpSecurity } from '../src/security/http-security.js';
import { MatchesModule } from '../src/matches/matches.module.js';
import { MatchRealtimeService } from '../src/matches/match-realtime.service.js';

describe('Production auth security through PostgreSQL and HTTP', () => {
  let app: INestApplication, db: PrismaService, auth: AuthService, userId: string, access: string, refresh: string;
  let leagueId: string, matchId: string;
  const run = randomUUID().slice(0, 8);
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.NODE_ENV !== 'test' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw new Error('Requires disposable loopback *_test PostgreSQL.');
    process.env.JWT_ACCESS_SECRET = 'security-access-' + run;
    process.env.JWT_REFRESH_SECRET = 'security-refresh-' + run;
    app = (await Test.createTestingModule({ imports: [PrismaModule, AuthModule, MatchesModule] }).compile()).createNestApplication();
    configureHttpSecurity(app); await app.listen(0,'127.0.0.1'); db=app.get(PrismaService); auth=app.get(AuthService);
    const account = await auth.register({ email: `security-${run}@example.invalid`, fullName: 'Security Fixture', inGameName: `Security${run}`,
      password: 'Security-test-42!', confirmPassword: 'Security-test-42!' });
    userId=account.data.user.id;
    const login = await auth.login({ email: `security-${run}@example.invalid`, password: 'Security-test-42!' });
    access=login.data.accessToken; refresh=login.data.refreshToken;
    leagueId=(await db.league.create({data:{name:'Stream Security',code:`SS${run}`,creatorUserId:userId}})).id;
    await db.leagueMember.create({data:{leagueId,userId,type:'PRIMARY'}});
    const cup=await db.tournament.create({data:{leagueId,createdByUserId:userId,name:'Stream Cup',code:`SS${run}`,
      mode:'SOLO',format:'ROUND_ROBIN',teamSize:1,maxEntries:4}});
    const fixture=await db.fixture.create({data:{tournamentId:cup.id,fixtureCode:`SS-${run}`,sequence:1,roundNumber:1,roundName:'Round 1',bracketPosition:1}});
    matchId=(await db.match.create({data:{tournamentId:cup.id,fixtureId:fixture.id}})).id;
  },30000);
  afterAll(async () => {
    vi.restoreAllMocks();
    if(leagueId) await db.league.delete({where:{id:leagueId}});
    if(userId) await db.user.delete({where:{id:userId}});
    await app?.close();
  });
  it('requires authentication and returns private response headers', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    const response=await request(app.getHttpServer()).get('/api/auth/me').set('Authorization',`Bearer ${access}`).expect(200);
    expect(response.body.data.user.id).toBe(userId);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it('rejects foreign origins before consuming a cookie session', async () => {
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Origin','https://attacker.invalid')
      .set('Cookie',`fc_arena_refresh_token=${refresh}`).expect(403);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization',`Bearer ${access}`).expect(200);
  });
  it('rejects role injection and unexpected input fields', async () => {
    await request(app.getHttpServer()).patch('/api/auth/preferences/theme').set('Authorization',`Bearer ${access}`)
      .send({themePreference:'CLASSIC_BLUE',role:'SUPER_ADMIN'}).expect(400);
    expect((await db.user.findUniqueOrThrow({where:{id:userId}})).role).toBe('USER');
  });
  it('does not erase a good session after a temporary service failure', async () => {
    const fail=vi.spyOn(auth,'refresh').mockRejectedValueOnce(new ServiceUnavailableException('Temporary test outage'));
    const response=await request(app.getHttpServer()).post('/api/auth/refresh')
      .set('Cookie',`fc_arena_refresh_token=${refresh}`).expect(503);
    expect(response.headers['set-cookie']).toBeUndefined(); fail.mockRestore();
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization',`Bearer ${access}`).expect(200);
  });
  it('rotates refresh tokens, rejects replay and revokes the old access session', async () => {
    const response=await request(app.getHttpServer()).post('/api/auth/refresh')
      .set('Cookie',`fc_arena_refresh_token=${refresh}`).expect(200);
    const cookie=response.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Path=/api/auth');
    expect(response.body.data.refreshToken).toBeUndefined();
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization',`Bearer ${access}`).expect(401);
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie',`fc_arena_refresh_token=${refresh}`).expect(401);
    access=response.body.data.accessToken; refresh=decodeURIComponent(cookie.split(';')[0].split('=').slice(1).join('='));
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization',`Bearer ${access}`).expect(200);
  });
  it('logout immediately revokes access and refresh sessions', async () => {
    await request(app.getHttpServer()).post('/api/auth/logout').set('Cookie',`fc_arena_refresh_token=${refresh}`).expect(200);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization',`Bearer ${access}`).expect(401);
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie',`fc_arena_refresh_token=${refresh}`).expect(401);
  });
  it.each(['logout','membership'])('closes an already-open private stream after %s without leaking the next score',async reason=>{
    const login=await auth.login({email:`security-${run}@example.invalid`,password:'Security-test-42!'});
    const stream=await fetch((await app.getUrl())+`/api/matches/${matchId}/events`,{
      headers:{Authorization:`Bearer ${login.data.accessToken}`},signal:AbortSignal.timeout(8000)});
    expect(stream.status).toBe(200);const reader=stream.body!.getReader();
    try{
      expect(new TextDecoder().decode((await reader.read()).value)).toContain('connected');
      if(reason==='logout')await auth.logout(login.data.refreshToken);
      else await db.leagueMember.delete({where:{leagueId_userId:{leagueId,userId}}});
      app.get(MatchRealtimeService).publish(matchId,'result_submitted',{homeScore:99});
      expect((await reader.read()).done).toBe(true);
    }finally{await reader.cancel().catch(()=>{});}
  });
});

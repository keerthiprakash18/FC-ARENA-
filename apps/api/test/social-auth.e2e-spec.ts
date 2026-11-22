import 'reflect-metadata';
import {randomBytes,createHash} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {Test} from '@nestjs/testing';
import type {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {AuthModule} from '../src/auth/auth.module.js';
import {AuthService} from '../src/auth/auth.service.js';
import {SocialProviderService} from '../src/auth/social-provider.service.js';
import {SocialStateStore} from '../src/auth/social-state.store.js';
import {PrismaModule} from '../src/database/prisma.module.js';
import {PrismaService} from '../src/database/prisma.service.js';
import {configureHttpSecurity} from '../src/security/http-security.js';

describe('social sign-in through real PostgreSQL, Redis, HTTP and refresh cookies',()=>{
  let app:INestApplication,db:PrismaService,auth:AuthService;
  const run=randomBytes(4).toString('hex'),users:string[]=[],password='Account-test-42!';
  const email=`social-${run}@example.invalid`,existingEmail=`existing-${run}@example.invalid`;
  const phone=(i:number)=>'+1'+String(Number.parseInt(run,16)).padStart(10,'0')+i;
  const profile={fullName:'Social Player',inGameName:'Social'+run,dateOfBirth:'1995-01-01',phoneNumber:phone(1)};
  const provider={providers:()=>({google:true,facebook:true}),requireProvider:()=>{},
    origins:()=>({api:'https://api.fcarena.in',web:'https://fcarena.in'}),
    authorization:vi.fn(async(_provider:string,state:string)=>'https://accounts.google.com/test?state='+state),
    identity:vi.fn(async(provider:string,_state:string,code:string)=>({provider,subject:run+'-'+code,
      email:code==='existing'?existingEmail:email,emailVerified:provider==='google',fullName:'Provider Player'}))};
  beforeAll(async()=>{
    const url=new URL(process.env.DATABASE_URL??'');
    if(process.env.NODE_ENV!=='test'||!url.pathname.endsWith('_test')||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('Disposable loopback *_test database required.');
    const module=await Test.createTestingModule({imports:[PrismaModule,AuthModule]}).overrideProvider(SocialProviderService).useValue(provider).compile();
    app=module.createNestApplication();configureHttpSecurity(app);await app.init();db=app.get(PrismaService);auth=app.get(AuthService);
    await db.authRateLimit.deleteMany({where:{action:{in:['REGISTER_IP','LOGIN_IP','SOCIAL_START_IP','SOCIAL_EXCHANGE_IP','SOCIAL_CALLBACK_IP']}}});
  });
  afterAll(async()=>{if(users.length)await db.user.deleteMany({where:{id:{in:users}}});await app?.close();});
  async function grant(providerCode='new') {
    const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
    const start=await request(app.getHttpServer()).post('/api/auth/social/start').send({provider:'google',challenge}).expect(200);
    const state=start.body.data.state;
    const begin=await request(app.getHttpServer()).get('/api/auth/social/begin?state='+state).expect(303);
    const cookie=begin.headers['set-cookie'][0].split(';')[0];
    const callback=await request(app.getHttpServer()).get(`/api/auth/social/callback/google?state=${state}&code=${providerCode}`).set('Cookie',cookie).expect(303);
    expect(callback.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
    const location=new URL(callback.headers.location);expect(location.origin).toBe('https://fcarena.in');
    expect(location.searchParams.has('accessToken')).toBe(false);
    return {state,verifier,code:location.searchParams.get('code')};
  }
  const exchange=(body:object)=>request(app.getHttpServer()).post('/api/auth/social/exchange').send(body);
  it('creates no account/session until all private profile fields are provided, then rejects replay',async()=>{
    const code=await grant(),result=await exchange(code).expect(200),ticket=result.body.data.ticket;
    expect(result.body.data.kind).toBe('register');expect(result.headers['set-cookie']).toBeUndefined();
    await request(app.getHttpServer()).post('/api/auth/social/register').send({ticket,fullName:profile.fullName,inGameName:profile.inGameName}).expect(400);
    expect(await db.user.count({where:{email}})).toBe(0);
    const completed=await request(app.getHttpServer()).post('/api/auth/social/register').send({ticket,...profile}).expect(200);
    users.push(completed.body.data.user.id);
    expect(completed.headers['set-cookie'][0]).toContain('HttpOnly');expect(completed.body.data.refreshToken).toBeUndefined();
    expect(completed.body.data.user.dateOfBirth).toBe(profile.dateOfBirth);
    const identity=await db.player.findUniqueOrThrow({where:{userId:users[0]}});
    expect(identity.whatsappNumber).toBeNull();expect(identity.whatsappShareEnabled).toBe(false);
    await exchange(code).expect(400);
    await request(app.getHttpServer()).post('/api/auth/social/register').send({ticket,...profile}).expect(400);
  });
  it('a linked identity signs in with the existing account and blocks suspended users',async()=>{
    const code=await grant(),login=await exchange(code).expect(200);
    expect(login.body.data.kind).toBe('session');expect(login.body.data.user.id).toBe(users[0]);
    await db.user.update({where:{id:users[0]},data:{status:'SUSPENDED'}});
    await exchange(await grant()).expect(401);
    await db.user.update({where:{id:users[0]},data:{status:'ACTIVE'}});
  });
  it('requires the old password to connect the same email and removes links on account deletion',async()=>{
    const account=await auth.register({...profile,inGameName:'Existing'+run,phoneNumber:phone(2),email:existingEmail,password,confirmPassword:password});users.push(account.data.user.id);
    const pending=await exchange(await grant('existing')).expect(200),ticket=pending.body.data.ticket;
    expect(pending.body.data.kind).toBe('connect');expect(pending.headers['set-cookie']).toBeUndefined();
    await request(app.getHttpServer()).post('/api/auth/social/connect').send({ticket,password:'Wrong-password'}).expect(401);
    const linked=await request(app.getHttpServer()).post('/api/auth/social/connect').send({ticket,password}).expect(200);
    expect(linked.body.data.user.id).toBe(account.data.user.id);
    await request(app.getHttpServer()).delete('/api/auth/account').set('Authorization','Bearer '+linked.body.data.accessToken).send({password,confirmation:'DELETE'}).expect(200);
    expect(await db.socialIdentity.count({where:{userId:account.data.user.id}})).toBe(0);
  },30000);
  it('a real Redis grant cannot be exchanged twice concurrently',async()=>{
    const code=await grant();const results=await Promise.all([exchange(code),exchange(code)]);
    expect(results.map(row=>row.status).sort()).toEqual([200,400]);
  });
  it('shares temporary state and locks across API processes',async()=>{
    const first=app.get(SocialStateStore),second=new SocialStateStore(),key=randomBytes(32).toString('base64url');
    try {
      await first.put('rehearsal',key,{synthetic:true},10);expect(await second.take('rehearsal',key)).toEqual({synthetic:true});expect(await first.take('rehearsal',key)).toBeNull();
      const release=await first.lock(key);expect(release).not.toBeNull();expect(await second.lock(key)).toBeNull();await release!();
    }finally{second.onModuleDestroy();}
  });
});

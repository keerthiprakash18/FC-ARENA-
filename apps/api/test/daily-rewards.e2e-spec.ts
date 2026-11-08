import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { beforeAll,afterAll,describe,expect,it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { PrismaModule } from '../src/database/prisma.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { SecurityModule } from '../src/security/security.module.js';
import { ExperienceModule } from '../src/experience/experience.module.js';
import { DailyRewardsService } from '../src/experience/daily-rewards.service.js';
import { ExperienceService } from '../src/experience/experience.service.js';
import { configureHttpSecurity } from '../src/security/http-security.js';
import { DAY_MS,dayKey } from '../src/experience/daily-reward-policy.js';

describe('Daily check-in ledger with real PostgreSQL and HTTP',()=>{
  let app:INestApplication,db:PrismaService,service:DailyRewardsService,experience:ExperienceService;
  const run=randomUUID().slice(0,8),users:string[]=[],password='Rewards-test-42!';
  const tokens=new Map<string,string>();
  beforeAll(async()=>{
    const url=new URL(process.env.DATABASE_URL??'');
    if(process.env.NODE_ENV!=='test'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!url.pathname.endsWith('_test'))throw Error('Requires disposable loopback *_test database.');
    process.env.JWT_ACCESS_SECRET='reward-access-'+run;process.env.JWT_REFRESH_SECRET='reward-refresh-'+run;
    app=(await Test.createTestingModule({imports:[PrismaModule,AuthModule,SecurityModule,ExperienceModule]}).compile()).createNestApplication();
    configureHttpSecurity(app);await app.init();db=app.get(PrismaService);service=app.get(DailyRewardsService);experience=app.get(ExperienceService);
  },30000);
  afterAll(async()=>{if(users.length)await db.user.deleteMany({where:{id:{in:users}}});await app?.close();});
  async function player(){const user=await db.user.create({data:{fullName:'Reward Fixture',email:`reward-${users.length}-${run}@example.invalid`,passwordHash:await bcrypt.hash(password,4),status:'ACTIVE'}});
    users.push(user.id);tokens.set(user.id,new JwtService().sign({sub:user.id,email:user.email,role:'USER',type:'access'},{secret:process.env.JWT_ACCESS_SECRET,expiresIn:180}));return user.id;}
  const get=(id:string,query='')=>request(app.getHttpServer()).get('/api/experience/me/check-in'+query).set('Authorization','Bearer '+tokens.get(id));
  const claim=(id:string,body:object={intent:'DAILY_CHECK_IN'})=>request(app.getHttpServer()).post('/api/experience/me/check-in').set('Authorization','Bearer '+tokens.get(id)).send(body);
  async function seed(id:string,balance:number,streak=0,lastDay?:string){
    await db.playerRewardWallet.create({data:{userId:id,balance,currentStreak:streak,longestStreak:streak,lastClaimDay:lastDay?new Date(lastDay+'T00:00:00Z'):undefined}});
    if(balance)await db.arenaCoinEntry.create({data:{userId:id,kind:'CHECK_IN',reference:'test-seed',delta:balance,balanceAfter:balance}});
  }
  it('serves an empty wallet without creating rows; protects identity and client-controlled amounts',async()=>{
    const id=await player();await request(app.getHttpServer()).get('/api/experience/me/check-in').expect(401);
    const data=(await get(id).expect(200)).body.data;expect(data.balance).toBe(0);expect(data.claimedToday).toBe(false);
    expect(data.policy).toMatchObject({dailyCoins:10,bonusCoins:30,bonusEvery:7,timeZone:'Asia/Kolkata'});
    expect(await db.playerRewardWallet.count({where:{userId:id}})).toBe(0);
    await claim(id,{intent:'DAILY_CHECK_IN',coins:9999,userId:randomUUID(),day:'2026-01-01'}).expect(400);
    await get(id,'?userId='+randomUUID()).expect(400);await get(id,'?month=2099-12').expect(400);
    expect(await db.playerDailyCheckIn.count({where:{userId:id}})).toBe(0);
  });
  it('credits exactly one reward for twenty simultaneous requests and safe retries',async()=>{
    const id=await player();const results=await Promise.all(Array.from({length:20},()=>service.claim(id)));
    expect(results.filter(result=>!result.data.receipt.alreadyApplied)).toHaveLength(1);
    expect((await get(id).expect(200)).body.data).toMatchObject({balance:10,streak:1,claimedToday:true});
    expect(await db.playerDailyCheckIn.count({where:{userId:id}})).toBe(1);
    expect(await db.arenaCoinEntry.count({where:{userId:id}})).toBe(1);
    expect((await claim(id).expect(201)).body.data.receipt.alreadyApplied).toBe(true);
  },20000);
  it('awards the seventh-day bonus and keeps claim and ledger amounts equal',async()=>{
    const id=await player(),today=(await get(id).expect(200)).body.data.today;
    const yesterday=dayKey(new Date(Date.parse(today+'T00:00:00Z')-DAY_MS));await seed(id,60,6,yesterday);
    const data=(await claim(id).expect(201)).body.data;
    expect(data).toMatchObject({balance:100,streak:7,longestStreak:7,cycleCompleted:7,todayReward:{totalCoins:40,bonusCoins:30}});
    const receipt=await db.playerDailyCheckIn.findFirstOrThrow({where:{userId:id}});expect(receipt.totalCoins).toBe(40);
    expect((await db.arenaCoinEntry.aggregate({where:{userId:id},_sum:{delta:true}}))._sum.delta).toBe(100);
  });
  it('restarts a missed streak without removing existing coins or the longest streak',async()=>{
    const id=await player(),today=(await get(id).expect(200)).body.data.today;
    await seed(id,90,9,dayKey(new Date(Date.parse(today+'T00:00:00Z')-2*DAY_MS)));
    expect((await get(id).expect(200)).body.data).toMatchObject({streak:0,balance:90,longestStreak:9});
    expect((await claim(id).expect(201)).body.data).toMatchObject({streak:1,balance:100,longestStreak:9});
  });
  it('charges once for repeated purchases, prevents overspending, and enforces ownership on equip',async()=>{
    const id=await player();await seed(id,100);
    const before=await experience.getMine(id);
    const bought=await Promise.all(Array.from({length:10},()=>service.purchase(id,'ROYAL_STRIPE')));
    expect(bought.filter(result=>!result.data.receipt.alreadyApplied)).toHaveLength(1);
    expect((await get(id).expect(200)).body.data.balance).toBe(0);
    await expect(service.purchase(id,'MIDNIGHT_GRID')).rejects.toMatchObject({status:409});
    await expect(service.equip(id,'MIDNIGHT_GRID')).rejects.toMatchObject({status:403});
    await service.equip(id,'ROYAL_STRIPE');
    const after=await experience.getMine(id);expect(after.data.totalXp).toBe(before.data.totalXp);expect(after.data.level).toBe(before.data.level);
    expect(after.data.cosmetics.background).toBe('ROYAL_STRIPE');
    const published=await experience.publicSummary(id,id);expect(published.data).not.toHaveProperty('balance');expect(published.data.cosmetics.background).toBe('ROYAL_STRIPE');
    expect(await db.arenaCoinEntry.count({where:{userId:id,kind:'COSMETIC_PURCHASE'}})).toBe(1);
  },20000);
  it('serializes mixed purchases and claims without losing credits or allowing a negative balance',async()=>{
    const id=await player();await seed(id,60);
    await Promise.allSettled([service.claim(id),service.purchase(id,'MIDNIGHT_GRID')]);
    await service.purchase(id,'MIDNIGHT_GRID');
    expect((await get(id).expect(200)).body.data.balance).toBe(0);
    expect((await db.arenaCoinEntry.aggregate({where:{userId:id},_sum:{delta:true}}))._sum.delta).toBe(0);
    await expect(db.playerRewardWallet.update({where:{userId:id},data:{balance:-1}})).rejects.toThrow();
  });
  it('uses strict catalog DTOs and keeps other players’ rewards private',async()=>{
    const id=await player(),other=await player();await service.claim(id);
    const base=request(app.getHttpServer()).post('/api/experience/me/cosmetics/purchase').set('Authorization','Bearer '+tokens.get(id));
    await base.send({itemId:'ROYAL_STRIPE',price:0}).expect(400);
    await request(app.getHttpServer()).patch('/api/experience/me/cosmetics/equip').set('Authorization','Bearer '+tokens.get(id)).send({itemId:'invalid'}).expect(400);
    expect((await get(other).expect(200)).body.data.balance).toBe(0);
  });
  it('rejects suspended accounts and erases private reward history on account deletion',async()=>{
    const id=await player();await service.claim(id);
    await db.user.update({where:{id},data:{status:'DISABLED'}});await claim(id).expect(401);
    await expect(service.claim(id)).rejects.toMatchObject({status:401});
    await db.user.update({where:{id},data:{status:'ACTIVE'}});
    await app.get(AuthService).deleteAccount(id,{password,confirmation:'DELETE'});
    expect(await db.playerRewardWallet.count({where:{userId:id}})).toBe(0);
    expect(await db.playerDailyCheckIn.count({where:{userId:id}})).toBe(0);
    expect(await db.arenaCoinEntry.count({where:{userId:id}})).toBe(0);
  },20000);
});

import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma, PlayerRewardWallet } from '../generated/prisma/client.js';
import { AuthRateLimitService } from '../auth/auth-rate-limit.service.js';
import { claimStreak, cosmeticSelection, DAILY_REWARD_POLICY, DAY_MS, dayKey, REWARD_COSMETICS, rewardFor, rewardWindow } from './daily-reward-policy.js';

@Injectable()
export class DailyRewardsService {
  constructor(private readonly prisma: PrismaService, private readonly limits: AuthRateLimitService) {}
  private async clock(db: Prisma.TransactionClient) {
    const [row] = await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    return row.now;
  }
  private async lock(db: Prisma.TransactionClient, userId: string) {
    // Keep account suspension/deletion ordered with this award, then serialize
    // all wallet mutations across tabs, devices and server processes.
    const [user] = await db.$queryRaw<{ status: string }[]>`SELECT status FROM users WHERE id=${userId}::uuid FOR SHARE`;
    if (user?.status !== 'ACTIVE') throw new UnauthorizedException('Your account is not active.');
    await db.$executeRaw`INSERT INTO player_reward_wallets ("userId", "updatedAt") VALUES (${userId}::uuid, NOW()) ON CONFLICT ("userId") DO NOTHING`;
    const [wallet] = await db.$queryRaw<PlayerRewardWallet[]>`SELECT * FROM player_reward_wallets WHERE "userId"=${userId}::uuid FOR UPDATE`;
    return wallet;
  }
  private async snapshot(db: Prisma.TransactionClient, userId: string, now: Date, month?: string) {
    const window = rewardWindow(now, month);
    const wallet = await db.playerRewardWallet.findUnique({ where: { userId } });
    const claims = await db.playerDailyCheckIn.findMany({ where: { userId, day: { gte: window.startsAt, lt: window.endsAt } }, orderBy: { day: 'asc' } });
    const todayClaim = window.month === window.today.slice(0,7)
      ? claims.find(claim=>dayKey(claim.day)===window.today)
      : await db.playerDailyCheckIn.findUnique({ where: { userId_day: { userId, day: new Date(window.today+'T00:00:00Z') } } });
    const owned = await db.playerOwnedCosmetic.findMany({ where: { userId }, select: { itemId: true } });
    const lastDay = wallet?.lastClaimDay ? dayKey(wallet.lastClaimDay) : null;
    const yesterday = dayKey(new Date(Date.parse(window.today+'T00:00:00Z')-DAY_MS));
    const streak = lastDay === window.today || lastDay === yesterday ? wallet?.currentStreak ?? 0 : 0;
    const selection = cosmeticSelection(wallet?.background, wallet?.badge);
    const ledger = await db.arenaCoinEntry.findMany({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8,
      select: { id: true, kind: true, delta: true, balanceAfter: true, createdAt: true } });
    return {
      serverNow: now.toISOString(), today: window.today, nextResetAt: window.nextResetAt, policy: DAILY_REWARD_POLICY,
      balance: wallet?.balance ?? 0, streak, longestStreak: wallet?.longestStreak ?? 0, claimedToday: !!todayClaim,
      todayReward: todayClaim ? { baseCoins: todayClaim.baseCoins, bonusCoins: todayClaim.bonusCoins, totalCoins: todayClaim.totalCoins }
        : rewardFor(claimStreak(lastDay, wallet?.currentStreak ?? 0, window.today)),
      cycleCompleted: todayClaim && streak % 7 === 0 ? 7 : streak % 7,
      calendar: { month: window.month, claims: claims.map(claim=>({ day: dayKey(claim.day), coins: claim.totalCoins, bonus: claim.bonusCoins, streak: claim.streak })) },
      cosmetics: selection,
      catalog: REWARD_COSMETICS.map(item=>({ ...item, owned: owned.some(record=>record.itemId===item.id), equipped: selection.background===item.id||selection.badge===item.id })),
      ledger: ledger.map(entry=>({ ...entry, createdAt: entry.createdAt.toISOString() })),
    };
  }
  async getMine(userId: string, month?: string) {
    const data = await this.prisma.$transaction(async db=>this.snapshot(db,userId,await this.clock(db),month), { isolationLevel: 'RepeatableRead' });
    return { success: true, data, error: null };
  }
  async claim(userId: string, month?: string) {
    await this.limits.consume('DAILY_REWARD_CLAIM',userId,30,60_000);
    return this.prisma.$transactionWithRetry(async db=>{
      const wallet = await this.lock(db,userId), now = await this.clock(db);
      const window = rewardWindow(now,month), day = new Date(window.today+'T00:00:00Z');
      const existing = await db.playerDailyCheckIn.findUnique({ where: { userId_day: { userId, day } } });
      if (!existing) {
        const streak = claimStreak(wallet.lastClaimDay ? dayKey(wallet.lastClaimDay) : null,wallet.currentStreak,window.today);
        const award = rewardFor(streak), balance = wallet.balance + award.totalCoins;
        await db.playerDailyCheckIn.create({ data: { userId, day, streak, ...award } });
        await db.playerRewardWallet.update({ where: { userId }, data: { balance, currentStreak: streak, longestStreak: Math.max(streak,wallet.longestStreak), lastClaimDay: day } });
        await db.arenaCoinEntry.create({ data: { userId, kind: 'CHECK_IN', reference: 'check-in:'+window.today, delta: award.totalCoins, balanceAfter: balance } });
      }
      const data = await this.snapshot(db,userId,now,month);
      return { success: true, data: { ...data, receipt: { kind: 'CHECK_IN', alreadyApplied: !!existing, coins: data.todayReward.totalCoins, bonus: data.todayReward.bonusCoins } }, error: null };
    },{ isolationLevel: 'ReadCommitted', maxWait: 10_000, timeout: 15_000 });
  }
  async purchase(userId: string, itemId: string, month?: string) {
    const item = REWARD_COSMETICS.find(item=>item.id===itemId);
    if (!item) throw new BadRequestException('Choose an available cosmetic.');
    await this.limits.consume('COIN_COSMETIC_PURCHASE',userId,20,60_000);
    return this.prisma.$transactionWithRetry(async db=>{
      const wallet = await this.lock(db,userId), now = await this.clock(db); rewardWindow(now,month);
      const owned = await db.playerOwnedCosmetic.findUnique({ where: { userId_itemId: { userId,itemId } } });
      if (!owned) {
        if (wallet.balance < item.price) throw new ConflictException({ success: false, data: null, error: { code: 'INSUFFICIENT_COINS', message: `You need ${item.price-wallet.balance} more Arena Coins to unlock ${item.name}.` } });
        const balance = wallet.balance-item.price;
        await db.playerOwnedCosmetic.create({ data: { userId,itemId } });
        await db.playerRewardWallet.update({ where: { userId }, data: { balance } });
        await db.arenaCoinEntry.create({ data: { userId,kind:'COSMETIC_PURCHASE',reference:'cosmetic:'+itemId,delta:-item.price,balanceAfter:balance } });
      }
      return { success:true, data:{ ...await this.snapshot(db,userId,now,month), receipt:{kind:'PURCHASE',alreadyApplied:!!owned,itemId,coins:owned?0:item.price} }, error:null };
    },{isolationLevel:'ReadCommitted',maxWait:10_000,timeout:15_000});
  }
  async equip(userId: string, itemId: string, month?: string) {
    const item = REWARD_COSMETICS.find(item=>item.id===itemId);
    if (!item && !['CLASSIC','NONE_BADGE'].includes(itemId)) throw new BadRequestException('Choose an available cosmetic.');
    await this.limits.consume('COIN_COSMETIC_EQUIP',userId,30,60_000);
    return this.prisma.$transactionWithRetry(async db=>{
      await this.lock(db,userId); const now = await this.clock(db); rewardWindow(now,month);
      if (item && !await db.playerOwnedCosmetic.findUnique({where:{userId_itemId:{userId,itemId}}})) throw new ForbiddenException('Unlock this cosmetic before equipping it.');
      const data = itemId==='NONE_BADGE' ? {badge:null} : itemId==='CLASSIC' || item?.kind==='BACKGROUND' ? {background:itemId} : {badge:itemId};
      await db.playerRewardWallet.update({where:{userId},data});
      return {success:true,data:{...await this.snapshot(db,userId,now,month),receipt:{kind:'EQUIP',itemId}},error:null};
    },{isolationLevel:'ReadCommitted',maxWait:10_000,timeout:15_000});
  }
}

import { BadRequestException } from '@nestjs/common';
export const DAILY_REWARD_POLICY = { dailyCoins: 10, bonusEvery: 7, bonusCoins: 30, timeZone: 'Asia/Kolkata', version: 1 } as const;
export const REWARD_COSMETICS = [
  { id: 'MIDNIGHT_GRID', name: 'Midnight Grid', kind: 'BACKGROUND', price: 70, description: 'A blue stadium grid for your player card.' },
  { id: 'ROYAL_STRIPE', name: 'Royal Stripe', kind: 'BACKGROUND', price: 100, description: 'A plum and gold edition of your player card.' },
  { id: 'ARENA_SPARK', name: 'Arena Spark', kind: 'BADGE', price: 50, description: 'A decorative spark badge on your player card.' },
] as const;
export const DAY_MS = 86_400_000;
const IST = 330 * 60_000;
export const dayKey = (value: Date) => value.toISOString().slice(0, 10);
export function rewardDay(now: Date) { return dayKey(new Date(now.getTime() + IST)); }
export function rewardWindow(now: Date, month?: string) {
  const today = rewardDay(now), selected = month ?? today.slice(0, 7);
  if (!/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(selected) || selected > today.slice(0,7)) {
    throw new BadRequestException('Choose a valid current or past month.');
  }
  const [year, number] = selected.split('-').map(Number);
  return { today, month: selected, startsAt: new Date(Date.UTC(year, number - 1, 1)),
    endsAt: new Date(Date.UTC(year, number, 1)),
    nextResetAt: new Date(Date.parse(today+'T00:00:00Z') - IST + DAY_MS).toISOString() };
}
export function claimStreak(lastDay: string | null, previous: number, today: string) {
  const yesterday = dayKey(new Date(Date.parse(today+'T00:00:00Z')-DAY_MS));
  return lastDay === yesterday ? previous + 1 : 1;
}
export function rewardFor(streak: number) {
  const bonusCoins = streak > 0 && streak % DAILY_REWARD_POLICY.bonusEvery === 0 ? DAILY_REWARD_POLICY.bonusCoins : 0;
  return { baseCoins: DAILY_REWARD_POLICY.dailyCoins, bonusCoins, totalCoins: DAILY_REWARD_POLICY.dailyCoins + bonusCoins };
}
export function cosmeticSelection(background?: string | null, badge?: string | null) {
  return {
    background: REWARD_COSMETICS.some(item=>item.id===background&&item.kind==='BACKGROUND') ? background! : 'CLASSIC',
    badge: REWARD_COSMETICS.some(item=>item.id===badge&&item.kind==='BADGE') ? badge! : null,
  };
}

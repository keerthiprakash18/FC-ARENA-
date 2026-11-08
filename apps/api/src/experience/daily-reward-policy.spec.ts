import { describe,expect,it } from 'vitest';
import { claimStreak,rewardDay,rewardFor,rewardWindow,cosmeticSelection } from './daily-reward-policy.js';
describe('Daily rewards use calendar days in IST',()=>{
  it('changes day exactly at midnight IST, independent of host or phone timezone',()=>{
    expect(rewardDay(new Date('2026-11-03T18:29:59.999Z'))).toBe('2026-11-03');
    expect(rewardDay(new Date('2026-11-03T18:30:00Z'))).toBe('2026-11-04');
    expect(rewardWindow(new Date('2026-11-03T18:29:59Z')).nextResetAt).toBe('2026-11-03T18:30:00.000Z');
  });
  it('continues streaks across months, years and leap days, but restarts after a gap',()=>{
    expect(claimStreak('2026-10-31',6,'2026-11-01')).toBe(7);
    expect(claimStreak('2026-12-31',13,'2027-01-01')).toBe(14);
    expect(claimStreak('2028-02-29',3,'2028-03-01')).toBe(4);
    expect(claimStreak('2026-11-01',6,'2026-11-03')).toBe(1);
    expect(claimStreak(null,0,'2026-11-03')).toBe(1);
  });
  it('gives 10 daily coins and exactly 30 extra every seventh consecutive day',()=>{
    expect(Array.from({length:14},(_,i)=>rewardFor(i+1).totalCoins)).toEqual([10,10,10,10,10,10,40,10,10,10,10,10,10,40]);
  });
  it('limits calendar filters to valid current/past months without trusting client dates',()=>{
    const now=new Date('2026-11-03T12:00:00Z');
    for(const month of ['2026-13','2026-00','2026-12','2026-11;DROP','invalid'])expect(()=>rewardWindow(now,month)).toThrow();
    expect(rewardWindow(now,'2024-02').endsAt.toISOString()).toBe('2024-03-01T00:00:00.000Z');
  });
  it('falls back safely for removed or invalid cosmetic IDs',()=>{
    expect(cosmeticSelection('ARENA_SPARK','ROYAL_STRIPE')).toEqual({background:'CLASSIC',badge:null});
    expect(cosmeticSelection('MIDNIGHT_GRID','ARENA_SPARK')).toEqual({background:'MIDNIGHT_GRID',badge:'ARENA_SPARK'});
  });
});

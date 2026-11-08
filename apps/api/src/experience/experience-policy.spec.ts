import { describe, expect, it } from 'vitest';
import {
  missionsForWeek,
  summarizeExperience,
  weekWindow,
} from './experience-policy.js';

describe('Verified player experience policy', () => {
  const now = new Date('2026-11-04T08:00:00Z');
  it('resets at exactly Monday midnight in India', () => {
    expect(weekWindow(new Date('2026-11-01T18:29:59.999Z')).key).toBe(
      '2026-10-26',
    );
    expect(weekWindow(new Date('2026-11-01T18:30:00Z'))).toMatchObject({
      key: '2026-11-02',
      startsAt: '2026-11-01T18:30:00.000Z',
      endsAt: '2026-11-08T18:30:00.000Z',
    });
  });
  it('starts at level one with a clear next milestone', () => {
    expect(summarizeExperience([], 0, false, 'CHAMPION', now)).toMatchObject({
      level: 1,
      totalXp: 0,
      xpToNextLevel: 100,
      frame: 'CLASSIC',
      streak: 0,
    });
  });
  it('awards each completed mission once, even beyond its target', () => {
    const result = summarizeExperience(
      [{ week: '2026-11-02', matches: 7, days: 3, teamMatches: 2 }],
      0,
      true,
      'CLASSIC',
      now,
    );
    expect(result.totalXp).toBe(215);
    expect(result.breakdown.missionXp).toBe(75);
    expect(result.week.completedMissions).toBe(4);
    expect(
      result.week.missions.find((m) => m.id === 'THREE_MATCHES')?.progress,
    ).toBe(3);
  });
  it('reconciles XP and unlocks after a result reversal without keeping stale bonuses', () => {
    const before = summarizeExperience(
      [{ week: '2026-11-02', matches: 10, days: 2, teamMatches: 0 }],
      1,
      false,
      'SKY',
      now,
    );
    expect(before).toMatchObject({ totalXp: 310, level: 3, frame: 'SKY' });
    const after = summarizeExperience(
      [{ week: '2026-11-02', matches: 2, days: 1, teamMatches: 0 }],
      0,
      false,
      'SKY',
      now,
    );
    expect(after).toMatchObject({
      totalXp: 50,
      level: 1,
      frame: 'CLASSIC',
      breakdown: { missionXp: 10 },
    });
  });
  it('keeps streak through an unfinished current week and stops across a missed week', () => {
    const weeks = ['2026-10-26', '2026-10-19', '2026-10-05'].map((week) => ({
      week,
      matches: 1,
      days: 1,
      teamMatches: 0,
    }));
    expect(summarizeExperience(weeks, 0, false, 'CLASSIC', now).streak).toBe(2);
    expect(
      summarizeExperience(weeks.slice(1), 0, false, 'CLASSIC', now).streak,
    ).toBe(0);
  });
  it('shows a squad mission only to players with relevant team activity', () => {
    const week = { week: '2026-11-02', matches: 0, days: 0, teamMatches: 0 };
    expect(missionsForWeek(week, false)).toHaveLength(3);
    expect(missionsForWeek(week, true)).toHaveLength(4);
  });
});

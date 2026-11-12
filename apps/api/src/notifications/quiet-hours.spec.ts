import { describe, expect, it } from 'vitest';
import { isQuietHoursActive, normalizeQuietHours } from './quiet-hours.js';

describe('opt-in phone push quiet hours (IST)', () => {
  it('stays disabled for existing users and rejects invalid stored hours', () => {
    expect(isQuietHoursActive(undefined, new Date('2026-11-12T18:00:00Z'))).toBe(false);
    expect(normalizeQuietHours({ enabled: true, startHour: -1, endHour: 24 }))
      .toEqual({ enabled: true, startHour: 22, endHour: 7 });
  });

  it('holds nonurgent pushes across midnight at the correct IST boundary', () => {
    const quiet = { enabled: true, startHour: 22, endHour: 7 };
    expect(isQuietHoursActive(quiet, new Date('2026-11-12T16:29:59Z'))).toBe(false); // 21:59 IST
    expect(isQuietHoursActive(quiet, new Date('2026-11-12T16:30:00Z'))).toBe(true); // 22:00 IST
    expect(isQuietHoursActive(quiet, new Date('2026-11-13T01:29:59Z'))).toBe(true); // 06:59 IST
    expect(isQuietHoursActive(quiet, new Date('2026-11-13T01:30:00Z'))).toBe(false); // 07:00 IST
  });

  it('supports same-day ranges, and equal start/end never suppress for 24h', () => {
    const now = new Date('2026-11-12T06:00:00Z'); // 11:30 IST
    expect(isQuietHoursActive({ enabled: true, startHour: 9, endHour: 12 }, now)).toBe(true);
    expect(isQuietHoursActive({ enabled: true, startHour: 12, endHour: 20 }, now)).toBe(false);
    expect(isQuietHoursActive({ enabled: true, startHour: 9, endHour: 9 }, now)).toBe(false);
  });
});

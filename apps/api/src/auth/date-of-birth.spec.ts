import { describe, expect, it } from 'vitest';
import { parseDateOfBirth } from './date-of-birth.service.js';

describe('Private date-of-birth validation', () => {
  const now = new Date('2026-11-06T20:00:00Z'); // Already 7 November in India.
  it.each(['1900-01-01', '1996-07-18', '2000-02-29', '2026-11-07'])(
    'preserves date-only value %s without a timezone shift',
    (value) => {
      expect(parseDateOfBirth(value, now).toISOString().slice(0, 10)).toBe(
        value,
      );
    },
  );
  it.each([
    '',
    '1899-12-31',
    '2001-02-29',
    '2025-04-31',
    '2026-11-08',
    '2026-13-01',
    '2000-1-1',
    '2000-01-01T00:00:00Z',
  ])('rejects invalid, impossible or future date %s', (value) => {
    expect.assertions(1);
    try {
      parseDateOfBirth(value, now);
    } catch (error) {
      expect(error).toMatchObject({
        response: { error: { code: 'INVALID_DATE_OF_BIRTH' } },
      });
    }
  });
});

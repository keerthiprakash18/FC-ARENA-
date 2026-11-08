import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayForBirthDate, validDateOfBirth } from '../apps/web/src/lib/date-of-birth.ts';

test('birth-date calendar follows the app day across midnight in India', () => {
  assert.equal(todayForBirthDate(new Date('2026-11-06T20:00:00Z')), '2026-11-07');
});
test('birth-date field accepts real date-only values and rejects invalid calendars and future values', () => {
  for (const value of ['1900-01-01', '2000-02-29', '1996-07-18']) assert.equal(validDateOfBirth(value), true);
  for (const value of ['', '1899-12-31', '2001-02-29', '2025-04-31', '2999-01-01', '2000-1-1', '2000-01-01T00:00:00Z']) assert.equal(validDateOfBirth(value), false);
});

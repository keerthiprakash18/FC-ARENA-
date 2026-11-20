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


import { birthdayDateForToday, birthdaySeenKey } from '../apps/web/src/lib/birthday-magic.ts';

test('birthday magic matches only the private owner DOB on the India calendar date', () => {
  const beforeIndiaMidnight = new Date('2026-11-19T18:20:00Z');
  const afterIndiaMidnight = new Date('2026-11-19T18:35:00Z');
  assert.equal(birthdayDateForToday('2001-11-20', beforeIndiaMidnight), null);
  assert.equal(birthdayDateForToday('2001-11-20T00:00:00.000Z', afterIndiaMidnight), '2026-11-20');
  assert.equal(birthdayDateForToday('2001-11-21', afterIndiaMidnight), null);
  assert.equal(birthdayDateForToday(null, afterIndiaMidnight), null);
  assert.equal(birthdayDateForToday('2001-02-29', afterIndiaMidnight), null);
  assert.equal(birthdayDateForToday('not-a-birthday', afterIndiaMidnight), null);
});

test('leap-day birthday uses February 28 in non-leap years and the actual date in leap years', () => {
  assert.equal(birthdayDateForToday('2000-02-29', new Date('2027-02-28T08:00:00Z')), '2027-02-28');
  assert.equal(birthdayDateForToday('2000-02-29', new Date('2028-02-28T08:00:00Z')), null);
  assert.equal(birthdayDateForToday('2000-02-29', new Date('2028-02-29T08:00:00Z')), '2028-02-29');
});

test('celebration dismissal is isolated per player and annual date', () => {
  assert.notEqual(birthdaySeenKey('player-a', '2026-11-20'), birthdaySeenKey('player-b', '2026-11-20'));
  assert.notEqual(birthdaySeenKey('player-a', '2026-11-20'), birthdaySeenKey('player-a', '2027-11-20'));
});

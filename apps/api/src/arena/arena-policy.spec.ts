import { describe, expect, it } from 'vitest';
import {
  decodeArenaCursor,
  encodeArenaCursor,
  normalizePoll,
  normalizeSourceUrl,
} from './arena-policy.js';
describe('Arena Talk input boundaries', () => {
  it('requires a safe HTTPS source for news and never accepts executable links', () => {
    expect(normalizeSourceUrl(' https://example.com/story ', true)).toBe(
      'https://example.com/story',
    );
    for (const input of [
      undefined,
      'javascript:alert(1)',
      'http://example.com',
      'https://user:password@example.com',
    ])
      expect(() => normalizeSourceUrl(input, true)).toThrow();
  });
  it('rejects duplicate, blank and oversized polls', () => {
    expect(normalizePoll([' Home ', 'Away'])).toEqual(['Home', 'Away']);
    for (const poll of [
      ['Same', 'same'],
      ['One', ' '],
      ['Only one'],
      ['a', 'b', 'c', 'd', 'e'],
    ])
      expect(() => normalizePoll(poll)).toThrow();
  });
  it('validates cursor identifiers and dates before they reach the database', () => {
    const value = {
      id: 'c1bad275-8173-4f28-8db4-a7669dd78de0',
      createdAt: new Date('2026-11-01T12:00:00Z'),
    };
    expect(decodeArenaCursor(encodeArenaCursor(value))).toEqual(value);
    for (const cursor of [
      'broken',
      Buffer.from('{"id":"invalid","at":"tomorrow"}').toString('base64url'),
    ])
      expect(() => decodeArenaCursor(cursor)).toThrow();
  });
});

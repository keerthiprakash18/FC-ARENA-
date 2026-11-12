import { describe, expect, it } from 'vitest';
import { resultPlayerIds } from './result-roster.js';

describe('confirmed result participant snapshots', () => {
  it('retains the original players even after a slot has a replacement', () => {
    expect(resultPlayerIds({ statEvents: [{ payload: { home: { userIds: ['original'] } } }] }, 'home', [{ userId: 'replacement' }])).toEqual(['original']);
  });
  it('treats an explicitly empty roster as authoritative and falls back for legacy or malformed events', () => {
    expect(resultPlayerIds({ statEvents: [{ payload: { home: { userIds: [] } } }] }, 'home', [{ userId: 'replacement' }])).toEqual([]);
    expect(resultPlayerIds({ statEvents: [{ payload: null }] }, 'away', [{ userId: 'original' }])).toEqual(['original']);
    expect(resultPlayerIds(undefined, 'away', [{ userId: 'original' }])).toEqual(['original']);
  });
});

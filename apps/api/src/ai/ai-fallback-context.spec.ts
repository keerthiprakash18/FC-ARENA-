import { describe, expect, it } from 'vitest';
import { AiService } from './ai.service.js';

const context = {
  player: { name: 'Player', playerCode: 'FCA-1', verified: true },
  leagues: [{ id: 'league-1', name: 'Arena League', membershipType: 'PRIMARY' }],
  tournaments: [],
  recentStatistics: [],
  upcomingFixtures: [{
    id: 'fix-1', fixtureCode: 'FCA-F-1', tournamentId: 't-1',
    tournament: 'UCL', roundName: 'Group A', matchday: 1,
    scheduledAt: '2026-11-12T00:00:00.000Z', status: 'SCHEDULED',
    home: 'India', away: 'Japan', matchId: null, matchStatus: null,
  }],
};
const answer = (message: string) =>
  (new AiService({} as never) as unknown as {
    localAnswer: (text: string, data: typeof context) => string;
  }).localAnswer(message, context);

describe('FC ARENA local fallback', () => {
  it('uses authenticated next fixture context, explicitly in IST', () => {
    const reply = answer('When is my next match?');
    expect(reply).toContain('Your next recorded fixture');
    expect(reply).toContain('India vs Japan');
    expect(reply).toContain('(IST)');
  });
  it('describes the player’s recorded league membership', () => {
    expect(answer('What is my league?')).toContain('Arena League (PRIMARY)');
  });
});

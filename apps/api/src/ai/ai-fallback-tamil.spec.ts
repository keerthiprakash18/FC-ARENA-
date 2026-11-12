import { describe, expect, it } from 'vitest';
import { AiService } from './ai.service.js';

const context = {
  player: { name: 'Player', playerCode: 'FCA-1', verified: true },
  leagues: [{ id: 'league-1', name: 'FC ARENA TAMIL', membershipType: 'PRIMARY' }],
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

describe('Tamil / English FC ARENA local fallback', () => {
  it('uses authenticated next fixture context, explicitly in IST', () => {
    expect(answer('அடுத்த மேட்ச் எப்போது?')).toContain('உங்களுடைய அடுத்த போட்டி');
    expect(answer('அடுத்த மேட்ச் எப்போது?')).toContain('India vs Japan');
    expect(answer('அடுத்த மேட்ச் எப்போது?')).toContain('(IST)');
    expect(answer('next match')).toContain('Your next recorded fixture');
  });
  it('answers current Tamil league question without invented membership', () => {
    expect(answer('எனது லீக் என்ன?')).toContain('FC ARENA TAMIL');
    expect(answer('எனது லீக் என்ன?')).toContain('உங்கள்');
  });
});

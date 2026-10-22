import { describe, expect, it, vi } from 'vitest';

import { PublicService } from './public.service.js';

describe('PublicService CSV export', () => {
  it('prefixes formula-like text with an apostrophe while preserving CSV quoting', async () => {
    const service = new PublicService({} as never);
    vi.spyOn(service, 'getTournament').mockResolvedValue({
      success: true,
      data: {
        tournament: { code: 'CUP-2026' },
        fixtures: [
          {
            fixtureCode: '=FIXTURE()\n',
            roundName: 'Round "One"',
            home: '+SUM(A1:A2)',
            away: 'Away',
            result: { homeScore: 2, awayScore: 1 },
          },
        ],
        standings: [
          {
            position: 1,
            name: '@command',
            played: 1,
            wins: 1,
            draws: 0,
            losses: 0,
            goalDifference: -1,
            points: 3,
          },
        ],
      },
      error: null,
    } as never);

    const response = await service.exportTournament('CUP-2026');

    expect(response.data.csv).toContain('"\'=FIXTURE()\n"');
    expect(response.data.csv).toContain('"Round ""One"""');
    expect(response.data.csv).toContain('"\'+SUM(A1:A2)"');
    expect(response.data.csv).toContain('"\'@command"');
    expect(response.data.csv).toContain('"-1"');
  });
});

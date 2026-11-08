import { describe, expect, it } from 'vitest';
import { csvCell } from './csv-cell.js';
import { PublicService } from '../public/public.service.js';
import { TournamentToolsService } from '../tournaments/tournament-tools.service.js';

describe('Spreadsheet-safe competition exports', () => {
  it.each(['=1+1', '+SUM(A1:A2)', '-CMD()', '@SUM(A1)', '\t=1+1', '\r\n =1+1', '\u0000=1+1', '＝1+1'])('neutralizes a user-authored formula: %j', value => {
    expect(csvCell(value).startsWith('"\'')).toBe(true);
  });
  it('preserves scores, goal differences, normal names and CSV escaping', () => {
    for (const value of [0, 12, -3, '12', '-3', '1.5']) expect(csvCell(value)).toBe(`"${value}"`);
    expect(csvCell('FC "Arena", Club')).toBe('"FC ""Arena"", Club"');
    expect(csvCell(null)).toBe('""'); expect(csvCell(undefined)).toBe('""');
  });
  it('uses the same protection for public and administrator exports', () => {
    const publicService = new PublicService({} as never);
    const tools = new TournamentToolsService({} as never, {} as never, {} as never, {} as never);
    for (const service of [publicService, tools]) {
      expect((service as unknown as { csv(value: string): string }).csv('=1+1')).toBe('"\'=1+1"');
    }
  });
});

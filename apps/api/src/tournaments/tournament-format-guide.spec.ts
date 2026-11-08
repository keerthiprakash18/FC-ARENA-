import { describe, expect, it } from 'vitest';
import { describeTournamentFormat } from './tournament-format-guide.js';

const base = {
  competitionFormat: 'GROUP_STAGE_KNOCKOUT', mode: 'SOLO', teamSize: 1, maxEntries: 36, status: 'ONGOING',
  groupMode: 'SINGLE_GROUP', legType: 'SINGLE_LEG', fixtureMode: 'AUTOMATIC', playoffSource: 'AUTO',
  qualifiersPerGroup: null, playoffQualifiersTotal: null, playoffFormat: 'GLOBAL_SEEDED', playoffSeedingBasis: 'AUTO',
  _count: { registrations: 12 }, groups: [],
};

describe('Tournament format guide follows saved qualification rules', () => {
  it.each([
    [36, 24, 8, 16, 12], [12, 12, 4, 8, 0], [3, 3, 1, 2, 0], [2, 2, 2, 0, 0],
  ])('describes adapted UCL with %i approved entries', (count, total, direct, playIn, eliminated) => {
    const guide = describeTournamentFormat({ ...base, competitionFormat: 'UCL_CUP', _count: { registrations: count }, playoffQualifiersTotal: 2, playoffSource: 'GROUP_QUALIFIERS' });
    expect(guide.qualification).toMatchObject({ state: 'READY', source: 'OVERALL_STANDINGS', total, direct, playIn, eliminated });
    expect(guide.qualification.bands[0]).toMatchObject({ from: 1, to: direct, tone: 'direct' });
    expect(guide.matchesPerEntry).toBe(Math.min(8, count - 1));
    expect(guide.knockoutRule).toContain('no away-goals rule');
  });

  it.each([[3, 3], [8, 8], [10, 8], [36, 16]])('uses the actual Elite auto field for %i entries', (count, total) => {
    const guide = describeTournamentFormat({ ...base, competitionFormat: 'ELITE_CUP', _count: { registrations: count } });
    expect(guide.qualification.total).toBe(total);
  });

  it('honours the saved Elite qualifier count', () => {
    expect(describeTournamentFormat({ ...base, competitionFormat: 'ELITE_CUP', playoffQualifiersTotal: 6 }).qualification.total).toBe(6);
  });

  it('counts places per actual group and marks only its qualifying ranks', () => {
    const guide = describeTournamentFormat({ ...base, groupMode: 'MULTIPLE_GROUPS', qualifiersPerGroup: 3,
      groups: ['A', 'B', 'C'].map(name => ({ name, _count: { registrations: 4 } })) });
    expect(guide.qualification).toMatchObject({ source: 'GROUP_QUALIFIERS', state: 'READY', total: 9, perGroup: 3, eliminated: 3 });
    expect(guide.qualification.bands).toEqual([{ from: 1, to: 3, label: 'Qualifying places in this group', tone: 'qualify' }]);
  });

  it('uses an explicit group source with two existing groups even when the group mode has changed', () => {
    const guide = describeTournamentFormat({ ...base, playoffSource: 'GROUP_QUALIFIERS', qualifiersPerGroup: 2,
      groups: [{ name: 'A', _count: { registrations: 6 } }, { name: 'B', _count: { registrations: 6 } }] });
    expect(guide.qualification).toMatchObject({ state: 'READY', total: 4, source: 'GROUP_QUALIFIERS' });
  });

  it('does not invent a group count or qualifiers when configuration is missing', () => {
    const guide = describeTournamentFormat({ ...base, playoffSource: 'GROUP_QUALIFIERS' });
    expect(guide.qualification).toMatchObject({ state: 'PENDING', total: null, bands: [] });
  });

  it('marks incomplete group assignment pending even when a place count is saved', () => {
    const guide = describeTournamentFormat({ ...base, groupMode: 'MULTIPLE_GROUPS', qualifiersPerGroup: 2,
      groups: [{ name: 'A', _count: { registrations: 4 } }, { name: 'B', _count: { registrations: 4 } }] });
    expect(guide.qualification).toMatchObject({ state: 'PENDING', bands: [] });
    expect(guide.note).toContain('group setup');
  });

  it.each(['LEAGUE_ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN', 'CUSTOM_MANUAL'])('never promises automatic playoffs for %s', competitionFormat => {
    expect(describeTournamentFormat({ ...base, competitionFormat }).qualification).toMatchObject({ state: 'NONE', total: null, bands: [] });
  });

  it.each(['MANUAL', 'RANDOM', 'GROUP_POSITION'])('does not imply top table positions qualify for %s selection', playoffSeedingBasis => {
    const guide = describeTournamentFormat({ ...base, playoffSeedingBasis, playoffQualifiersTotal: 4 });
    expect(guide.qualification).toMatchObject({ total: 4, bands: [] });
    expect(guide.note).toContain('selects the playoff field');
  });

  it('keeps manual fixture counts unknown and explains team entry sizes', () => {
    const guide = describeTournamentFormat({ ...base, fixtureMode: 'MANUAL', mode: 'TEAM', teamSize: 5 });
    expect(guide).toMatchObject({ matchesPerEntry: null, entryLabel: 'teams', teamSize: 5, approvedEntries: 12 });
    expect(guide.fixtureRule).toContain('manually');
  });

  it('waits for enough approved entries and rejects impossible saved qualification totals', () => {
    expect(describeTournamentFormat({ ...base, competitionFormat: 'UCL_CUP', _count: { registrations: 0 } }).qualification.state).toBe('PENDING');
    expect(describeTournamentFormat({ ...base, playoffQualifiersTotal: 20 }).qualification).toMatchObject({ state: 'PENDING', bands: [] });
  });

  it('describes a second-chance route when configured', () => {
    expect(describeTournamentFormat({ ...base, playoffFormat: 'DOUBLE_CHANCE' }).knockoutRule).toContain('second-chance');
  });

  it('includes the saved bracket format and tournament name for the visual preview', () => {
    expect(describeTournamentFormat({ ...base, name: 'Arena Open', playoffFormat: 'PROTECTED_SEED' })).toMatchObject({ tournamentName: 'Arena Open', playoffFormat: 'PROTECTED_SEED' });
    expect(describeTournamentFormat({ ...base, competitionFormat: 'UCL_CUP' }).playoffFormat).toBe('UCL_TWO_LEG');
    expect(describeTournamentFormat({ ...base, competitionFormat: 'LEAGUE_ROUND_ROBIN' }).playoffFormat).toBeNull();
  });

  it('marks a two-entry double-chance field pending because its bracket requires three entries', () => {
    expect(describeTournamentFormat({ ...base, playoffFormat: 'DOUBLE_CHANCE', playoffQualifiersTotal: 2 }).qualification).toMatchObject({ state: 'PENDING', bands: [] });
  });
});

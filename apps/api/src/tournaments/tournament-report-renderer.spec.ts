import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { imagePagesToPdf, renderTournamentTeamList, tournamentTeamListPages, wrapReportText } from './tournament-report-renderer.js';
import type { TournamentTeamList } from './tournament-report.types.js';

const roster = (count: number): TournamentTeamList => ({ generatedAt: '2026-11-08T10:00:00Z', tournament: { id: 'cup', name: 'International Friendlies', code: 'FCA-T-TEST', description: null, logoUrl: null, mode: 'TEAM', format: 'ROUND_ROBIN', competitionFormat: 'GROUP_STAGE_KNOCKOUT', groupMode: 'MULTIPLE_GROUPS', legType: 'SINGLE_LEG', teamSize: 3, status: 'REGISTRATION_CLOSED', startAt: null, endAt: null, completedAt: null, league: { id: 'league', name: 'KICKOFF FC', code: 'KF', logoUrl: null } }, overview: { teams: count, players: count, groups: 8, pending: 2 }, teams: Array.from({ length: count }, (_, i) => ({ id: 'team-' + i, name: `TEAM-${String(i).padStart(3, '0')}`, groupId: 'group', groupName: 'Group A', logoUrl: 'https://private.invalid/unfetched.svg', members: [{ id: 'player-' + i, name: 'PLAYER-' + String(i).padStart(3, '0'), playerCode: 'FCA-' + i, profileImageUrl: null }] })) });
describe('visual roster pagination and valid binary exports', () => {
  it('retains every approved team and player across page breaks beyond a typical first page', () => {
    const data = roster(128), pages = tournamentTeamListPages(data), svg = pages.join('');
    expect(pages.length).toBeGreaterThan(5);
    for (const team of data.teams) { expect(svg).toContain(team.name); expect(svg).toContain(team.members[0].name); }
    expect(svg).toContain('awaiting approval'); expect(svg).not.toContain('private.invalid');
    pages.forEach((page, i) => expect(page).toContain(`${i + 1} / ${pages.length}`));
  });
  it('escapes supplied XML and preserves Tamil, emoji, long tokens and paragraph breaks', () => {
    const data = roster(1); data.teams[0].name = '<script>Injected & team</script>'; data.teams[0].members[0].name = 'தமிழ் வீரர்கள் 🏆';
    const svg = tournamentTeamListPages(data).join('');
    expect(svg).not.toContain('<script>'); expect(svg).toContain('&lt;script&gt;Injected'); expect(svg).toContain('தமிழ் வீரர்கள் 🏆');
    const long = 'தமிழ்வீரர்கள்அணி'.repeat(30);
    expect(wrapReportText(long, 150).join('')).toBe(long); expect(wrapReportText('first\nsecond', 900)).toEqual(['first', 'second']);
  });
  it('produces a valid PDF cross-reference table using byte offsets for binary image streams', () => {
    const pdf = imagePagesToPdf([Buffer.from([255,216,10,201,0,255,217]), Buffer.from([255,216,255,217])]);
    const raw = pdf.toString('latin1'), pointer = Number(/startxref\n(\d+)/.exec(raw)![1]);
    expect(raw.slice(pointer, pointer + 4)).toBe('xref'); expect(raw).toContain('/Count 2');
    const entries = raw.slice(pointer).split('\n').slice(3, 11);
    for (const [i, entry] of entries.entries()) expect(raw.slice(Number(entry.slice(0, 10)))).toMatch(new RegExp(`^${i + 1} 0 obj`));
  });
  it('renders the entire multi-page team list to a single PNG and a paginated A4 PDF', async () => {
    const data = roster(25), pages = tournamentTeamListPages(data);
    const png = await renderTournamentTeamList(data, 'png'), metadata = await sharp(png.bytes).metadata();
    expect(metadata.width).toBe(1240); expect(metadata.height).toBe(1754 * pages.length);
    const pdf = await renderTournamentTeamList(data, 'pdf'); expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-'); expect(pdf.pages).toBe(pages.length);
  }, 30000);
});

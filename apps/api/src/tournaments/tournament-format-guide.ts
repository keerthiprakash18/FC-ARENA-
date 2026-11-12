import type { PrismaService } from '../database/prisma.service.js';
import { resolveEliteCupPlayoffQualifierCount } from './elite-cup-engine.js';
import { uclQualification } from './ucl-engine.js';

interface FormatInput {
  name?: string;
  competitionFormat: string; mode: string; teamSize: number; maxEntries: number; status: string;
  groupMode: string; legType: string; fixtureMode: string; playoffSource: string;
  qualifiersPerGroup: number | null; playoffQualifiersTotal: number | null;
  playoffFormat: string; playoffSeedingBasis: string;
  _count: { registrations: number };
  groups?: { name: string; _count: { registrations: number } }[];
}
export interface Band { from: number; to: number; label: string; tone: 'direct' | 'playoff' | 'qualify' }
const names: Record<string, string> = {
  LEAGUE_ROUND_ROBIN: 'Round-robin league', DOUBLE_ROUND_ROBIN: 'Home-and-away league',
  GROUP_STAGE_KNOCKOUT: 'Group stage + knockout', SINGLE_ELIMINATION: 'Single elimination',
  ELITE_CUP: 'Elite Cup', UCL_CUP: 'UCL Cup', CUSTOM_MANUAL: 'Custom competition',
};
const bracketNames: Record<number, string> = { 2: 'final', 4: 'semi-finals', 8: 'quarter-finals', 16: 'round of 16' };

/** Describe saved rules using the same qualification resolvers as the bracket engine. */
export function describeTournamentFormat(t: FormatInput) {
  const count = Math.max(0, t._count?.registrations ?? 0);
  const format = t.competitionFormat;
  const groups = (t.groups ?? []).map(g => ({ name: g.name, entries: g._count.registrations }));
  const groupCount = groups.length;
  const grouped = t.groupMode === 'MULTIPLE_GROUPS' && groupCount > 1;
  const isUcl = format === 'UCL_CUP', isElite = format === 'ELITE_CUP';
  const isLeague = ['LEAGUE_ROUND_ROBIN', 'DOUBLE_ROUND_ROBIN'].includes(format);
  const isKnockout = format === 'SINGLE_ELIMINATION';
  const hasStage = !isKnockout;
  const legs = format === 'DOUBLE_ROUND_ROBIN' || t.legType === 'HOME_AWAY' ? 2 : 1;
  const source = isUcl ? 'OVERALL_STANDINGS' : t.playoffSource !== 'AUTO' ? t.playoffSource
    : isKnockout ? 'DIRECT_ENTRIES' : grouped ? 'GROUP_QUALIFIERS' : 'OVERALL_STANDINGS';
  let total: number | null = null, direct: number | null = null, playIn: number | null = null;
  let state: 'READY' | 'PENDING' | 'NONE' = count >= 2 ? 'READY' : 'PENDING';
  let description = 'Approve at least two entries to calculate the qualification places.';
  let note: string | null = null;
  const bands: Band[] = [];
  const next = isUcl ? (count >= 2 ? bracketNames[uclQualification(count).knockoutSize] : null) : null;
  if (isLeague) {
    state = 'NONE'; description = 'No knockout qualification. The final league table decides the finishing places and league winner.';
  } else if (format === 'CUSTOM_MANUAL') {
    state = 'NONE'; description = 'The organiser controls the custom fixtures and progression. Automatic qualification is not configured for this format.';
  } else if (isKnockout) {
    total = count; description = `${count} approved entries enter the knockout draw. Follow the published bracket for progression and any byes.`;
  } else if (count >= 2 && isUcl) {
    const q = uclQualification(count); total = q.qualifiers; direct = q.direct; playIn = total - direct;
    description = `Top ${direct} advance directly to the ${next}.`;
    if (playIn) description += ` Places ${direct + 1}–${total} (${playIn} entries) play two-leg qualifying ties for the remaining ${q.knockoutSize - direct} places.`;
    description += count > total ? ` Places ${total + 1}–${count} are eliminated after the league phase.` : ' Every approved entry reaches a knockout stage.';
    if (direct) bands.push({ from: 1, to: direct, label: `Direct to ${next}`, tone: 'direct' });
    if (playIn) bands.push({ from: direct + 1, to: total, label: 'Knockout play-off places', tone: 'playoff' });
  } else if (source === 'GROUP_QUALIFIERS') {
    const perGroup = t.qualifiersPerGroup;
    if (groupCount < 2 || !perGroup || perGroup < 1) {
      state = 'PENDING'; description = 'Group qualification is not ready. The organiser must save the groups and the number qualifying from each group.';
    } else {
      total = perGroup * groupCount;
      const unassigned = count - groups.reduce((sum, g) => sum + g.entries, 0);
      if (groups.some(g => g.entries < perGroup) || unassigned > 0) {
        state = 'PENDING'; note = 'Some groups do not yet contain enough approved entries, or entries still need a group. The organiser must complete group setup.';
      }
      const directTotal = total;
      const requestedTotal = t.playoffQualifiersTotal ?? directTotal;
      const extraTotal = requestedTotal - directTotal;
      if (!Number.isInteger(requestedTotal) || extraTotal < 0 || extraTotal > groupCount) {
        state = 'PENDING';
        note = `Saved playoff total must be between ${directTotal} and ${directTotal + groupCount} for top ${perGroup} per group with optional best next-place qualifiers.`;
        description = `Group qualification cannot be finalized until the organizer corrects the playoff total (${requestedTotal}).`;
      } else if (extraTotal > 0) {
        if (new Set(groups.map(group => group.entries)).size !== 1) {
          state = 'PENDING';
          note = 'Best next-place selection requires equally sized groups; rebalance before publishing.';
        }
        total = requestedTotal;
        description = `Top ${perGroup} from each of ${groupCount} groups qualify directly (${directTotal} places), plus the best ${extraTotal} next-place finishers across those groups: ${total} playoff places.`;
        note = state === 'READY'
          ? 'Only direct places are highlighted in group tables. Best next-place selection is decided from confirmed results across all groups; ties use points, goal difference, goals scored, wins, then entry name and ID.'
          : note;
      } else {
        description = `Top ${perGroup} from each of ${groupCount} groups advance: ${total} qualifying places in total.`;
      }
      if (state === 'READY') bands.push({ from: 1, to: perGroup, label: extraTotal > 0 ? 'Direct group qualifying places' : 'Qualifying places in this group', tone: 'qualify' });
    }
  } else if (count >= 2) {
    total = t.playoffQualifiersTotal ?? (isElite ? resolveEliteCupPlayoffQualifierCount(count) : count);
    if (!Number.isInteger(total) || total < 2 || total > count) {
      state = 'PENDING'; description = `${total} playoff places are saved, but ${count} entries are approved. The organiser must complete or correct playoff setup.`;
    } else {
      description = total === count ? `All ${count} approved entries enter the knockout stage after the league phase.` : `Top ${total} in the overall table advance to the knockout stage. Places ${total + 1}–${count} are eliminated.`;
      bands.push({ from: 1, to: total, label: 'Knockout qualifying places', tone: 'qualify' });
    }
  }
  const effectiveSource = isLeague || format === 'CUSTOM_MANUAL' ? 'NONE' : source;
  const directSeeding = ['DIRECT_ENTRIES', 'OVERALL_STANDINGS'].includes(effectiveSource);
  if (hasStage && !isUcl && directSeeding && ['MANUAL', 'RANDOM', 'GROUP_POSITION'].includes(t.playoffSeedingBasis)) {
    note = `${t.playoffSeedingBasis === 'MANUAL' ? 'Saved entry seed order' : t.playoffSeedingBasis === 'RANDOM' ? 'A random draw' : 'Group position, then performance'} selects the playoff field. Table highlights do not confirm qualification for this seeding basis.`;
    bands.length = 0;
    if (total !== null && state === 'READY') description = `${total} entries enter playoffs using ${t.playoffSeedingBasis.toLowerCase().replaceAll('_', ' ')} seeding.`;
  }
  if (!isUcl && state === 'READY' && t.playoffFormat === 'DOUBLE_CHANCE' && total !== null && total < 3) {
    state = 'PENDING'; bands.length = 0;
    description = 'Double-chance playoffs need at least three qualifying entries. The organiser must adjust the playoff setup.';
  }
  const matches = count < 2 || t.fixtureMode === 'MANUAL' ? null : isUcl || isElite ? Math.min(8, count - 1)
    : isKnockout || format === 'CUSTOM_MANUAL' || t.fixtureMode === 'MANUAL' ? null
    : grouped ? null : (count - 1) * legs;
  const stage = isKnockout ? 'Knockout draw → winners advance → champion'
    : isLeague ? 'League fixtures → final table → league winner'
    : format === 'CUSTOM_MANUAL' ? 'Custom fixtures → organiser-defined progression'
    : isUcl ? `League phase → ${playIn ? 'qualifying ties → ' : ''}${next ?? 'knockout bracket'} → champion`
    : `${grouped && !isElite ? 'Group stage' : 'League phase'} → knockout bracket → champion`;
  const fixtureRule = isKnockout ? 'Follow the published bracket for each knockout tie.'
    : t.fixtureMode === 'MANUAL' ? 'Fixtures are scheduled manually by the organiser; see the published fixture list.'
    : isUcl || isElite ? `One league-phase schedule; each entry plays ${matches ?? 'up to 8'} different opponents.`
    : grouped ? `Each entry plays the other approved entries in its group ${legs === 2 ? 'home and away' : 'once'}. Group sizes determine the match count.`
    : `Each entry plays every other approved entry ${legs === 2 ? 'home and away' : 'once'}${matches === null ? '' : `: ${matches} matches per entry`}.`;
  return {
    tournamentName: t.name ?? names[format] ?? 'Tournament',
    playoffFormat: isLeague || format === 'CUSTOM_MANUAL' ? null : isUcl ? 'UCL_TWO_LEG' : t.playoffFormat,
    title: names[format] ?? 'Tournament format', competitionFormat: format, approvedEntries: count, capacity: t.maxEntries,
    entryLabel: t.mode === 'SOLO' ? 'players' : t.mode === 'DUO' ? 'duos' : 'teams', teamSize: t.teamSize,
    mode: t.mode, groupCount, groups, stage, fixtureRule, matchesPerEntry: matches,
    qualification: { state, source: effectiveSource, total, direct, playIn, perGroup: source === 'GROUP_QUALIFIERS' ? t.qualifiersPerGroup : null,
      eliminated: state === 'READY' && total !== null && !isKnockout ? Math.max(0, count - total) : null, description, bands },
    scoring: hasStage && format !== 'CUSTOM_MANUAL' ? 'Win 3 points · Draw 1 point · Loss 0 points' : null,
    ranking: isUcl ? 'Points, goal difference, goals scored, away goals, wins, away wins, then opponents’ results; remaining ties use seed order.'
      : isKnockout || format === 'CUSTOM_MANUAL' ? null : 'Points, goal difference, goals scored, then wins. Follow the published table for the final tie-break order.',
    knockoutRule: isUcl ? 'Two-leg knockout ties; aggregate goals decide the winner. A tied aggregate needs penalties. The final is one match; no away-goals rule.'
      : !isLeague && format !== 'CUSTOM_MANUAL' ? `${t.playoffFormat === 'DOUBLE_CHANCE' ? 'Double-chance playoffs include a second-chance route for eligible entries; follow the published bracket.' : t.playoffFormat === 'PROTECTED_SEED' ? 'Protected-seed playoffs use the published seeded bracket.' : 'Global seeded playoffs use the published knockout bracket.'} Any bye means direct entry to the next bracket round.` : null,
    note, provisional: !['COMPLETED', 'CANCELLED'].includes(t.status),
  };
}

export async function loadTournamentFormatGuide(prisma: PrismaService, tournamentId: string) {
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: {
    name: true,
    competitionFormat: true, mode: true, teamSize: true, maxEntries: true, status: true, groupMode: true, legType: true,
    fixtureMode: true, playoffSource: true, qualifiersPerGroup: true, playoffQualifiersTotal: true, playoffFormat: true, playoffSeedingBasis: true,
    _count: { select: { registrations: { where: { status: 'APPROVED' } } } },
    groups: { orderBy: { position: 'asc' }, select: { name: true, _count: { select: { registrations: { where: { status: 'APPROVED' } } } } } },
  } });
  return t ? describeTournamentFormat(t) : null;
}

export const formats = {
  LEAGUE_ROUND_ROBIN: 'League / round robin',
  DOUBLE_ROUND_ROBIN: 'Double round robin',
  SINGLE_ELIMINATION: 'Knockout',
  GROUP_STAGE_KNOCKOUT: 'Group + knockout',
  ELITE_CUP: 'Elite Cup',
  UCL_CUP: 'UCL Cup',
  CUSTOM_MANUAL: 'Custom schedule',
};
export const modes = {
  SOLO: { label: 'Solo', description: '1 player per entry', icon: 'profile' },
  DUO: { label: 'Duo', description: '2 players per entry', icon: 'team' },
  TEAM: { label: 'Team', description: '3–11 players per squad', icon: 'football' },
} as const;

export type Mode = keyof typeof modes;
export type Format = keyof typeof formats;
export type Settings = {
  name: string; mode: Mode; competitionFormat: Format; maxEntries: number;
  teamSize: number; registrationMode: 'APPROVAL' | 'OPEN' | 'ADMIN_ONLY';
  description: string;
};
export type Tournament = Settings & {
  id: string; leagueId: string; status: string; groupMode: string; legType: string;
  fixtureMode: string; qualifiersPerGroup: number | null; playoffQualifiersTotal: number | null;
  groups: { id: string; name: string }[];
  _count: { fixtures: number; matches: number };
};
export type Player = { id: string; name: string; avatar: string | null };
export type Entry = {
  id: string; name: string | null; logo: string | null; groupId: string | null;
  members: Player[]; captainId: string; status: string; valid: boolean;
};
type DrawnEntry = Pick<Entry, 'id' | 'name' | 'members' | 'captainId'>;
export type GroupResult = { id: string; name: string; entryIds: string[] };
export type Outcome =
  | { kind: 'MANUAL' | 'PLAYER' | 'AUTO'; entries: DrawnEntry[]; unassigned: number; options?: Player[] }
  | { kind: 'CLUB'; entryId: string; winner: string; options: string[] }
  | { kind: 'GROUP'; groups: GroupResult[] };
export type Studio = {
  tournament: Tournament; editable: boolean; publishedFixtureCount: number;
  revision: string; fixtures: Fixture[];
  availablePlayers: Player[]; entries: Entry[]; history: { requestId: string; outcome: Outcome }[];
};
export type Fixture = {
  id: string; roundName: string; sequence: number; homeRegistrationId: string | null;
  awayRegistrationId: string | null;
};
export type DrawCommand = {
  kind: Outcome['kind']; playerIds?: string[]; poolPlayerIds?: string[]; captainId?: string; name?: string;
  entryId?: string; reason?: string; groupCount?: number; clubs?: string[];
};

export function entryName(entry: Pick<Entry, 'name' | 'members'>) {
  return entry.name || entry.members.map(player => player.name).join(' + ') || 'Unnamed entry';
}

export function teamSize(settings: Settings) {
  return settings.mode === 'SOLO' ? 1 : settings.mode === 'DUO' ? 2 : settings.teamSize;
}

export function validation(settings: Settings) {
  if (settings.name.trim().length < 3) return 'Enter a tournament name with at least three characters.';
  if (!Number.isInteger(settings.maxEntries) || settings.maxEntries < 2 || settings.maxEntries > 128) return 'Enter a capacity from 2 to 128.';
  if (settings.mode === 'TEAM' && (!Number.isInteger(settings.teamSize) || settings.teamSize < 3 || settings.teamSize > 11)) return 'Enter a squad size from 3 to 11.';
  return '';
}

export function estimate(tournament: Tournament, approved: Entry[]) {
  const total = approved.length;
  const roundRobin = (count: number) => count * (count - 1) / 2;
  switch (tournament.competitionFormat) {
    case 'LEAGUE_ROUND_ROBIN': return roundRobin(total);
    case 'DOUBLE_ROUND_ROBIN': return 2 * roundRobin(total);
    case 'SINGLE_ELIMINATION': return Math.max(0, total - 1) * (tournament.legType === 'HOME_AWAY' ? 2 : 1);
    case 'GROUP_STAGE_KNOCKOUT': return tournament.groups.length
      ? tournament.groups.reduce((sum, group) => sum + roundRobin(approved.filter(entry => entry.groupId === group.id).length), 0) *
        (tournament.legType === 'HOME_AWAY' ? 2 : 1)
      : null;
    default: return null;
  }
}

export function readStored<T>(key: string) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : null;
  } catch { return null; }
}

export function storeLocally(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

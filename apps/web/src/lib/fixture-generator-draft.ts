export type FixtureParticipantType =
  | 'TEAM'
  | 'PLAYER';

export type FixtureMeetings =
  | 'SINGLE'
  | 'HOME_AWAY';

export type FixtureMethod =
  | 'ROUND_ROBIN'
  | 'RANDOM_ROUND_ROBIN'
  | 'MANUAL';

export type FixtureScope =
  | 'TOURNAMENT'
  | 'GROUP';

export type HomeAwayMode =
  | 'BALANCED'
  | 'RANDOM'
  | 'MANUAL';

export interface FixtureParticipantMeta {
  registrationId: string;
  name: string;
  shortName?: string;
  logoUrl?: string | null;
  source:
    | 'MANUAL'
    | 'TOURNAMENT'
    | 'LEAGUE';
}

export interface FixtureGeneratorDraft {
  fixtureListName: string;
  participantType:
    FixtureParticipantType;
  leagueId: string;
  tournamentId: string;
  scope:
    FixtureScope;
  groupId: string | null;
  meetings:
    FixtureMeetings;
  method:
    FixtureMethod;
  participantCount: number;

  selectedRegistrationIds:
    string[];

  participants:
    FixtureParticipantMeta[];

  homeAwayMode:
    HomeAwayMode;
  matchdayPrefix: string;
  startDate: string;
  matchdayIntervalDays: number;
  defaultMatchTime: string;
}

const STORAGE_KEY =
  'fc-arena:fixture-generator-draft:v2';

export const defaultFixtureGeneratorDraft:
  FixtureGeneratorDraft = {
    fixtureListName:
      '',
    participantType:
      'TEAM',
    leagueId:
      '',
    tournamentId:
      '',
    scope:
      'TOURNAMENT',
    groupId:
      null,
    meetings:
      'SINGLE',
    method:
      'ROUND_ROBIN',
    participantCount:
      8,
    selectedRegistrationIds:
      [],
    participants:
      [],
    homeAwayMode:
      'BALANCED',
    matchdayPrefix:
      'Matchday',
    startDate:
      '',
    matchdayIntervalDays:
      1,
    defaultMatchTime:
      '',
  };

export function loadFixtureGeneratorDraft() {
  if (
    typeof window ===
    'undefined'
  ) {
    return {
      ...defaultFixtureGeneratorDraft,
    };
  }

  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY,
      );

    if (!raw) {
      return {
        ...defaultFixtureGeneratorDraft,
      };
    }

    const parsed =
      JSON.parse(
        raw,
      ) as Partial<FixtureGeneratorDraft>;

    return {
      ...defaultFixtureGeneratorDraft,
      ...parsed,

      selectedRegistrationIds:
        Array.isArray(
          parsed.selectedRegistrationIds,
        )
          ? parsed.selectedRegistrationIds
          : [],

      participants:
        Array.isArray(
          parsed.participants,
        )
          ? parsed.participants
          : [],
    };
  } catch {
    return {
      ...defaultFixtureGeneratorDraft,
    };
  }
}

export function saveFixtureGeneratorDraft(
  draft:
    FixtureGeneratorDraft,
) {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      draft,
    ),
  );
}

export function patchFixtureGeneratorDraft(
  patch:
    Partial<FixtureGeneratorDraft>,
) {
  const next = {
    ...loadFixtureGeneratorDraft(),
    ...patch,
  };

  saveFixtureGeneratorDraft(
    next,
  );

  return next;
}

export function clearFixtureGeneratorDraft() {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  window.localStorage.removeItem(
    STORAGE_KEY,
  );
}

export function expectedRoundRobinCounts(
  participants:
    number,

  meetings:
    FixtureMeetings,
) {
  const singleRounds =
    participants %
    2 ===
    0
      ? participants -
        1
      : participants;

  const singleMatches =
    (
      participants *
      (
        participants -
        1
      )
    ) /
    2;

  if (
    meetings ===
    'HOME_AWAY'
  ) {
    return {
      rounds:
        singleRounds *
        2,
      matches:
        singleMatches *
        2,
    };
  }

  return {
    rounds:
      singleRounds,
    matches:
      singleMatches,
  };
}

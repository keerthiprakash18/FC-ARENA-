export const EXPERIENCE_POLICY = {
  matchXp: 20,
  tournamentXp: 50,
  timeZone: 'Asia/Kolkata',
  version: 1,
} as const;

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const IST = 330 * 60_000;

export interface ExperienceWeek {
  week: string;
  matches: number;
  days: number;
  teamMatches: number;
}

export const PLAYER_FRAMES = [
  { id: 'CLASSIC', name: 'Classic', level: 1 },
  { id: 'SKY', name: 'Skyline', level: 3 },
  { id: 'GOLD', name: 'Gold standard', level: 6 },
  { id: 'CHAMPION', name: 'Champion', level: 10 },
] as const;
export type PlayerFrame = (typeof PLAYER_FRAMES)[number]['id'];

export function weekWindow(now = new Date()) {
  const local = new Date(now.getTime() + IST);
  const monday = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
  );
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const key = monday.toISOString().slice(0, 10);
  const startsAt = new Date(monday.getTime() - IST);
  return {
    key,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + WEEK).toISOString(),
    timeZone: EXPERIENCE_POLICY.timeZone,
  };
}

export function missionsForWeek(week: ExperienceWeek, includeTeam: boolean) {
  return [
    {
      id: 'FIRST_MATCH',
      title: 'Get on the pitch',
      description: 'Complete one verified match.',
      target: 1,
      progress: week.matches,
      xp: 10,
      unit: 'match',
    },
    {
      id: 'TWO_DAYS',
      title: 'Find your rhythm',
      description: 'Play verified matches on two different days.',
      target: 2,
      progress: week.days,
      xp: 20,
      unit: 'days',
    },
    {
      id: 'THREE_MATCHES',
      title: 'Make it a matchweek',
      description: 'Complete three verified matches this week.',
      target: 3,
      progress: week.matches,
      xp: 30,
      unit: 'matches',
    },
    ...(includeTeam
      ? [
          {
            id: 'SQUAD_SESSION',
            title: 'Better together',
            description:
              'Complete a verified duo or team match with your registered squad.',
            target: 1,
            progress: week.teamMatches,
            xp: 15,
            unit: 'squad match',
          },
        ]
      : []),
  ].map((mission) => ({
    ...mission,
    progress: Math.min(mission.target, Math.max(0, mission.progress)),
    completed: mission.progress >= mission.target,
  }));
}

export function summarizeExperience(
  weeks: ExperienceWeek[],
  completedTournaments: number,
  hasTeam: boolean,
  selectedFrame = 'CLASSIC',
  now = new Date(),
) {
  const window = weekWindow(now);
  const current = weeks.find((week) => week.week === window.key) ?? {
    week: window.key,
    matches: 0,
    days: 0,
    teamMatches: 0,
  };
  const matches = weeks.reduce((sum, week) => sum + week.matches, 0);
  const bonusXp = weeks.reduce(
    (sum, week) =>
      sum +
      missionsForWeek(week, week.teamMatches > 0)
        .filter((mission) => mission.completed)
        .reduce((xp, mission) => xp + mission.xp, 0),
    0,
  );
  const totalXp =
    matches * EXPERIENCE_POLICY.matchXp +
    completedTournaments * EXPERIENCE_POLICY.tournamentXp +
    bonusXp;
  const level = Math.floor((1 + Math.sqrt(1 + totalXp / 12.5)) / 2);
  const levelStartXp = 50 * level * (level - 1);
  const nextLevelXp = 50 * level * (level + 1);
  const title =
    level >= 15
      ? 'Icon'
      : level >= 10
        ? 'Veteran'
        : level >= 6
          ? 'Playmaker'
          : level >= 3
            ? 'Contender'
            : 'Rookie';
  const active = new Set(
    weeks.filter((week) => week.matches > 0).map((week) => week.week),
  );
  let cursor = Date.parse(window.key + 'T00:00:00Z');
  if (!active.has(window.key)) cursor -= WEEK;
  let streak = 0;
  while (active.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak++;
    cursor -= WEEK;
  }
  const missions = missionsForWeek(current, hasTeam || current.teamMatches > 0);
  const frames = PLAYER_FRAMES.map((frame) => ({
    ...frame,
    unlocked: level >= frame.level,
  }));
  const frame =
    frames.find((frame) => frame.id === selectedFrame && frame.unlocked)?.id ??
    'CLASSIC';
  return {
    level,
    title,
    totalXp,
    levelStartXp,
    nextLevelXp,
    xpInLevel: totalXp - levelStartXp,
    xpToNextLevel: nextLevelXp - totalXp,
    levelProgress: Math.floor(
      ((totalXp - levelStartXp) / (nextLevelXp - levelStartXp)) * 100,
    ),
    frame,
    frames,
    streak,
    verifiedMatches: matches,
    completedTournaments,
    breakdown: {
      matchXp: matches * EXPERIENCE_POLICY.matchXp,
      tournamentXp: completedTournaments * EXPERIENCE_POLICY.tournamentXp,
      missionXp: bonusXp,
    },
    week: {
      ...window,
      verifiedMatches: current.matches,
      activeDays: current.days,
      missions,
      completedMissions: missions.filter((mission) => mission.completed).length,
      earnedBonusXp: missions
        .filter((mission) => mission.completed)
        .reduce((sum, mission) => sum + mission.xp, 0),
    },
    recentWeeks: [...weeks]
      .sort((a, b) => b.week.localeCompare(a.week))
      .slice(0, 6),
    policy: {
      ...EXPERIENCE_POLICY,
      note: 'XP reflects verified participation. Profile levels are separate from competitive rankings and Fair Play. Corrected or reversed results are reflected automatically.',
    },
  };
}

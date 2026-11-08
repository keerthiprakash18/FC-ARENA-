export interface PlayerExperience {
  cosmetics?: { background:string; badge:string|null };
  level: number;
  title: string;
  totalXp: number;
  xpInLevel: number;
  xpToNextLevel: number;
  levelProgress: number;
  nextLevelXp: number;
  frame: string;
  streak: number;
  verifiedMatches: number;
  completedTournaments: number;
  frames: { id: string; name: string; level: number; unlocked: boolean }[];
  breakdown: { matchXp: number; tournamentXp: number; missionXp: number };
  week: {
    key: string;
    endsAt: string;
    completedMissions: number;
    earnedBonusXp: number;
    missions: {
      id: string;
      title: string;
      description: string;
      target: number;
      progress: number;
      xp: number;
      completed: boolean;
    }[];
  };
  policy: { matchXp: number; tournamentXp: number; note: string };
}
export interface PlayerCardData {
  name: string;
  code: string | null;
  avatar: string | null;
  verified: boolean;
  matches: number;
  wins: number;
  goals: number;
  winRate: number;
}
export type ApiData<T> = { success: boolean; data: T; error: unknown };
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

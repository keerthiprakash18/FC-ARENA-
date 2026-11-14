export interface ArenaAuthor {
  id: string;
  name: string;
  inGameName: string | null;
  playerCode: string | null;
  avatarUrl: string | null;
  verified: boolean;
}
export interface ArenaComment {
  id: string;
  body: string;
  author: ArenaAuthor;
  createdAt: string;
  editedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canReport: boolean;
}
export interface ArenaPost {
  id: string;
  kind: string;
  body: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  createdAt: string;
  editedAt: string | null;
  audience: "PUBLIC" | "LEAGUE";
  league: { id: string; name: string } | null;
  author: ArenaAuthor | null;
  liked: boolean;
  reactionCount: number;
  commentCount: number;
  canEdit: boolean;
  canDelete: boolean;
  canReport: boolean;
  result: {
    matchId: string;
    tournamentName: string;
    home: string;
    away: string;
    homeScore: number;
    awayScore: number;
    homePenaltyScore: number | null;
    awayPenaltyScore: number | null;
  } | null;
  poll: {
    endsAt: string;
    closed: boolean;
    totalVotes: number;
    selectedOptionId: string | null;
    options: { id: string; label: string; votes: number; percent: number }[];
  } | null;
}
export interface ArenaContext {
  leagues: { id: string; name: string; subscribed?: boolean }[];
  mutedPlayers?: { id: string; fullName: string }[];
  canModerate: boolean;
  policy: { audienceNote: string };
}
export const arenaReasons = [
  ["HARASSMENT_OR_BULLYING", "Harassment or bullying"],
  ["HATE_OR_ABUSE", "Hate or abuse"],
  ["SPAM_OR_SCAM", "Spam or scam"],
  ["IMPERSONATION", "Impersonation"],
  ["INAPPROPRIATE_CONTENT", "Inappropriate content"],
  ["OTHER", "Other"],
];

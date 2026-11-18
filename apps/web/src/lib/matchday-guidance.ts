/**
 * Player-facing guidance, never an inferred result or match state.
 * Always keep a path to the authoritative match room.
 */
export type MatchdayState = 'LIVE' | 'TODAY' | 'UPCOMING' | 'POSTPONED' | 'UNSCHEDULED' | 'PENDING';

export interface MatchdayGuidance {
  heading: string;
  description: string;
  actionLabel: string;
}

export function getMatchdayGuidance(state: MatchdayState): MatchdayGuidance {
  switch (state) {
    case 'LIVE':
      return { heading: 'Match in progress', description: 'Open the match room for the current status and official actions.', actionLabel: 'Open live match' };
    case 'TODAY':
      return { heading: 'Your matchday is here', description: 'Check the kickoff time and coordinate with your opponent before playing.', actionLabel: 'Open match details' };
    case 'UPCOMING':
      return { heading: 'Get ready to play', description: 'Review your opponent and kickoff time; the match room has the latest information.', actionLabel: 'View match details' };
    case 'POSTPONED':
      return { heading: 'Awaiting a new time', description: 'This fixture is postponed. Check the match room or contact the organizer for updates.', actionLabel: 'Check fixture status' };
    case 'UNSCHEDULED':
      return { heading: 'Kickoff not set', description: 'The fixture exists, but no kickoff time is set. Coordinate with the organizer.', actionLabel: 'View fixture' };
    case 'PENDING':
      return { heading: 'Check outstanding fixture', description: 'The kickoff time has passed, but the official match status needs attention. Open the match room.', actionLabel: 'Check match status' };
  }
}

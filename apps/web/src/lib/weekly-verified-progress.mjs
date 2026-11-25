/**
 * Read-only weekly player goals; prefer canonical experience totals to bounded career history.
 *
 * This is an activity view, NOT a claimable reward system. Only completed,
 * verified result history is considered. No client-side coin/XP mutations.
 * Weeks are Monday 00:00 through next Monday 00:00 in Asia/Kolkata (IST).
 *
 * @typedef {{id: string, confirmedAt: string, outcome?: string}} VerifiedMatch
 */
const IST_OFFSET_MS = 330 * 60_000;

export function weekWindowIst(now = Date.now()) {
  if (!Number.isFinite(now)) throw new RangeError('Invalid current time');
  const shifted = new Date(now + IST_OFFSET_MS);
  const dayIndex = (shifted.getUTCDay() + 6) % 7;
  const start = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - dayIndex,
  ) - IST_OFFSET_MS;
  return { start, end: start + 7 * 24 * 60 * 60_000 };
}

/**
 * @param {readonly VerifiedMatch[]} history
 * @param {number} [now]
 */
export function weeklyVerifiedProgress(history, now = Date.now()) {
  const { start, end } = weekWindowIst(now);
  const seen = new Set();
  let matches = 0;
  let wins = 0;
  for (const match of Array.isArray(history) ? history : []) {
    if (!match || typeof match.id !== 'string' || seen.has(match.id)) continue;
    const confirmedAt = Date.parse(match.confirmedAt);
    if (!Number.isFinite(confirmedAt) || confirmedAt < start || confirmedAt >= end) continue;
    seen.add(match.id);
    matches++;
    if (match.outcome === 'W') wins++;
  }
  return progressSummary(matches, wins, start, end);
}

function progressSummary(matches, wins, start, end) {
  return {
    matches,
    wins,
    start,
    end,
    goals: [
      { id: 'verified-1', label: 'Play 1 verified match', target: 1, value: Math.min(1, matches) },
      { id: 'verified-3', label: 'Play 3 verified matches', target: 3, value: Math.min(3, matches) },
      { id: 'win-1', label: 'Win 1 verified match', target: 1, value: Math.min(1, wins) },
    ],
  };
}

/**
 * The server counts unique current APPLY events across all verified history.
 * Never turn missing legacy fields into an authoritative zero.
 * @param {{startsAt?: string, endsAt?: string, verifiedMatches?: number, verifiedWins?: number} | null | undefined} week
 * @param {readonly VerifiedMatch[]} history
 * @param {number} [now]
 */
export function weeklyActivityProgress(week, history, now = Date.now()) {
  const start = Date.parse(week?.startsAt ?? '');
  const end = Date.parse(week?.endsAt ?? '');
  const matches = week?.verifiedMatches;
  const wins = week?.verifiedWins;
  if (typeof matches === 'number' && typeof wins === 'number' &&
      Number.isSafeInteger(matches) && Number.isSafeInteger(wins) &&
      matches >= 0 && wins >= 0 && wins <= matches &&
      Number.isFinite(start) && Number.isFinite(end) &&
      weekWindowIst(start).start === start && weekWindowIst(start).end === end) {
    return { ...progressSummary(matches, wins, start, end), source: 'canonical' };
  }
  return { ...weeklyVerifiedProgress(history, now), source: 'recent-history' };
}

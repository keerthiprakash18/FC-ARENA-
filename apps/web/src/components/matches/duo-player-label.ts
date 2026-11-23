/** Keep the player's name visible even when their in-game name is a club name. */
export function duoPlayerLabel(player: { fullName: string; inGameName: string | null }): string {
  const fullName = player.fullName.trim();
  const inGameName = player.inGameName?.trim() ?? '';
  if (!fullName) return inGameName || 'Player';
  if (!inGameName || inGameName.toLowerCase() === fullName.toLowerCase()) return fullName;
  return `${fullName} (${inGameName})`;
}

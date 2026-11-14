export function leagueInviteQuery(search: string) {
  const invite = new URLSearchParams(search).get('invite') || '';
  return /^[a-f0-9]{48}$/.test(invite) ? `?invite=${invite}` : '';
}

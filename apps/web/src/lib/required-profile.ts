import { leagueInviteQuery } from './league-invite';
export function hasWhatsAppNumber(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const number = value.replace(/[\s().-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(number) || /^[6-9]\d{9}$/.test(number);
}
export function needsRequiredProfile(user: {
  dateOfBirth?: string | null;
  phoneNumber?: string | null;
}) {
  return !user.dateOfBirth || !hasWhatsAppNumber(user.phoneNumber);
}
export function signedInDestination(
  user: { dateOfBirth?: string | null; phoneNumber?: string | null },
  search = '',
) {
  const invite = leagueInviteQuery(search);
  return needsRequiredProfile(user)
    ? '/profile/complete' + invite
    : invite
      ? '/leagues' + invite
      : '/dashboard';
}

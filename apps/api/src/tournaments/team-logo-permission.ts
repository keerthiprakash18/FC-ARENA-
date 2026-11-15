import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { TournamentRegistrationStatus, TournamentStatus } from '../generated/prisma/client.js';

type LogoSettings = { status: TournamentStatus; allowActiveTeamLogoEdits: boolean };
type LogoEntry = { status: TournamentRegistrationStatus; registeredByUserId: string; members: { userId: string }[] };

export function teamLogoLock(
  tournament: LogoSettings,
  entry: LogoEntry,
  userId: string,
  isAdmin: boolean,
) {
  if (tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED') {
    return { code: 'ENTRY_LOGO_LOCKED', message: 'This tournament has ended. Team logos are read-only.' };
  }
  if (isAdmin) return null;

  const isMember = entry.members.some(member => member.userId === userId);
  if (tournament.status === 'ACTIVE') {
    if (isMember && entry.status === 'APPROVED') {
      return tournament.allowActiveTeamLogoEdits ? null
        : { code: 'ENTRY_LOGO_LOCKED', message: 'Ask a tournament admin to enable team logo uploads.' };
    }
    return { code: 'ENTRY_LOGO_PERMISSION_REQUIRED', message: 'Only approved team members can manage this logo.' };
  }
  if ((!isMember && entry.registeredByUserId !== userId) || !['APPROVED', 'PENDING'].includes(entry.status)) {
    return { code: 'ENTRY_LOGO_PERMISSION_REQUIRED', message: 'Only this entry’s players or a tournament admin can manage its logo.' };
  }
  return null;
}

export function assertTeamLogoPermission(
  tournament: LogoSettings,
  entry: LogoEntry,
  userId: string,
  isAdmin: boolean,
) {
  const error = teamLogoLock(tournament, entry, userId, isAdmin);
  if (!error) return;
  const response = { success: false, data: null, error };
  if (error.code === 'ENTRY_LOGO_LOCKED') throw new ConflictException(response);
  throw new ForbiddenException(response);
}

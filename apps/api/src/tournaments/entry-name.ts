import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

export function normalizeEntryName(name: string) {
  return name.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export async function assertUniqueEntryName(
  db: Pick<Prisma.TransactionClient, 'tournamentRegistration'>,
  tournamentId: string,
  name: string | null,
  ignoreRegistrationId?: string,
) {
  if (!name) return;
  const existing = await db.tournamentRegistration.findMany({
    where: {
      tournamentId,
      status: { in: ['APPROVED', 'PENDING'] },
      ...(ignoreRegistrationId ? { id: { not: ignoreRegistrationId } } : {}),
    },
    select: { entryName: true },
  });
  if (existing.some((entry) => entry.entryName && normalizeEntryName(entry.entryName) === normalizeEntryName(name))) {
    throw new ConflictException({
      success: false,
      data: null,
      error: {
        code: 'ENTRY_NAME_ALREADY_EXISTS',
        message: `“${name.trim()}” already exists in this Tournament. Choose a different team name.`,
      },
    });
  }
}

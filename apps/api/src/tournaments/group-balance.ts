import { ConflictException } from '@nestjs/common';

export type GroupBalanceInput = {
  id: string;
  name: string;
  registrations: Array<{ id: string }>;
};

export type GroupMove = {
  registrationId: string;
  fromGroupId: string | null;
  groupId: string;
};

function fail(code: string, message: string): never {
  throw new ConflictException({
    success: false, data: null, error: { code, message },
  });
}

/** A fixture may only be generated/published for a complete, even group draw. */
export function assertBalancedGroups(
  groups: GroupBalanceInput[],
  approvedTotal: number,
): void {
  if (groups.length < 2) {
    fail('GROUPS_NOT_READY', 'Configure at least two groups first.');
  }
  const registrationIds = groups.flatMap((group) =>
    group.registrations.map((entry) => entry.id),
  );
  if (
    registrationIds.length !== approvedTotal ||
    new Set(registrationIds).size !== approvedTotal
  ) {
    fail('UNASSIGNED_ENTRIES', 'Assign every approved team exactly once before generating or publishing fixtures.');
  }
  const counts = groups.map((group) => group.registrations.length);
  if (Math.min(...counts) < 2) {
    fail('GROUP_NOT_PLAYABLE', 'Each group requires at least two approved teams.');
  }
  if (Math.max(...counts) - Math.min(...counts) > 1) {
    fail(
      'GROUPS_UNBALANCED',
      `Group sizes must differ by at most one team. Current sizes: ${groups.map((g) => `${g.name}: ${g.registrations.length}`).join(', ')}. Use Rebalance Groups before generating/publishing fixtures.`,
    );
  }
}

/**
 * Minimise disruption to existing groups. Stable ties follow group order.
 * Unassigned teams fill vacancies before members are moved between groups.
 */
export function planGroupRebalance(
  groups: GroupBalanceInput[],
  unassigned: string[],
): GroupMove[] {
  const total = unassigned.length + groups.reduce((n, group) => n + group.registrations.length, 0);
  if (groups.length < 2 || total < groups.length * 2) {
    fail('GROUPS_NOT_PLAYABLE', 'There must be at least two teams per group.');
  }
  const everyId = [...unassigned, ...groups.flatMap((g) => g.registrations.map((r) => r.id))];
  if (new Set(everyId).size !== everyId.length) {
    fail('DUPLICATE_GROUP_ENTRY', 'A team appears in more than one group.');
  }

  const base = Math.floor(total / groups.length);
  const extras = total % groups.length;
  const target = groups.map(() => base);
  const priority = groups.map((group, index) => ({ index, size: group.registrations.length }))
    .sort((a, b) => b.size - a.size || a.index - b.index);
  for (const { index } of priority.slice(0, extras)) target[index]++;

  const pool: Array<{ id: string; from: string | null }> = unassigned.map((id) => ({ id, from: null }));
  groups.forEach((group, index) => {
    for (const entry of group.registrations.slice(target[index])) {
      pool.push({ id: entry.id, from: group.id });
    }
  });
  const moves: GroupMove[] = [];
  groups.forEach((group, index) => {
    const missing = target[index] - Math.min(group.registrations.length, target[index]);
    for (let i = 0; i < missing; i++) {
      const next = pool.shift();
      if (!next) fail('GROUP_REBALANCE_FAILED', 'Not enough participants to balance groups.');
      moves.push({ registrationId: next.id, fromGroupId: next.from, groupId: group.id });
    }
  });
  if (pool.length) fail('GROUP_REBALANCE_FAILED', 'The group draw could not be balanced.');
  return moves;
}

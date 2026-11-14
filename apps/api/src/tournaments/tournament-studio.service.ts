import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuthorizationService } from '../security/authorization.service.js';
import type { PublishStudioDto, TournamentDrawDto } from './dto/tournament-studio.dto.js';
import { normalizeEntryName } from './entry-name.js';
import { assertBalancedGroupCounts } from './group-balance.js';
import { TournamentFixturePreviewService } from './tournament-fixture-preview.service.js';
import { TournamentWizardFinalizeService } from './tournament-wizard-finalize.service.js';

const action = 'TOURNAMENT_STUDIO_DRAW';
const targetType = 'TournamentStudioDraw';
const userSelect = {
  id: true, fullName: true,
  player: { select: { profileImageUrl: true, identity: { select: { inGameName: true } } } },
} as const;

type PlayerUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;
type Entry = Prisma.TournamentRegistrationGetPayload<{ include: { members: true } }>;
type StudioTournament = Prisma.TournamentGetPayload<{ include: {
  groups: true;
  _count: { select: { fixtures: true; matches: true } };
} }>;

function toPlayer(user: PlayerUser) {
  return { id: user.id, name: user.player?.identity?.inGameName || user.fullName, avatar: user.player?.profileImageUrl ?? null };
}

function shuffle<T>(values: readonly T[]) {
  const pool = [...values];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const next = randomInt(index + 1);
    [pool[index], pool[next]] = [pool[next]!, pool[index]!];
  }
  return pool;
}

function isEditable(tournament: StudioTournament) {
  return ['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'].includes(tournament.status) &&
    !tournament.publishedAt && !tournament.fixturesPublishedAt && !tournament.fixturesGeneratedAt &&
    !tournament._count.fixtures && !tournament._count.matches;
}

function requireReason(reason?: string) {
  if (!reason || reason.trim().length < 3) throw new BadRequestException('Enter an override reason of at least three characters.');
}

function validEntry(entry: Entry, teamSize: number, isEligible: (id: string) => boolean) {
  return entry.members.length === teamSize && entry.members.some(member => member.userId === entry.registeredByUserId) &&
    entry.members.every(member => isEligible(member.userId));
}

function liveEntries(entries: Entry[]) {
  return entries.filter(entry => entry.status === 'APPROVED' || entry.status === 'PENDING');
}

@Injectable()
export class TournamentStudioService {
  constructor(
    private readonly prisma: PrismaService, private readonly auth: AuthorizationService,
    private readonly preview: TournamentFixturePreviewService, private readonly finalize: TournamentWizardFinalizeService,
  ) {}

  private tournament(db: Prisma.TransactionClient, id: string) {
    return db.tournament.findUniqueOrThrow({
      where: { id },
      include: { groups: { orderBy: { position: 'asc' } }, _count: { select: { fixtures: true, matches: true } } },
    });
  }

  private eligible(db: Prisma.TransactionClient, leagueId: string) {
    return db.user.findMany({
      where: { status: 'ACTIVE', leagueMemberships: { some: { leagueId } }, player: { is: { identity: { isNot: null } } } },
      select: userSelect,
      orderBy: { id: 'asc' },
    });
  }

  private entries(db: Prisma.TransactionClient, tournamentId: string) {
    return db.tournamentRegistration.findMany({
      where: { tournamentId },
      include: { members: { orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }] } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async get(userId: string, id: string) {
    await this.auth.assertCanManageTournamentPermission(userId, id, 'MANAGE_PARTICIPANTS');
    const data = await this.prisma.$transaction(tx => this.snapshot(tx, id), { isolationLevel: 'RepeatableRead' });
    return { success: true, data, error: null };
  }

  private async snapshot(db: Prisma.TransactionClient, id: string) {
    const tournament = await this.tournament(db, id);
    const [eligible, entries, draws, fixtures] = await Promise.all([
      this.eligible(db, tournament.leagueId),
      this.entries(db, id),
      db.auditLog.findMany({
        where: { action, scopeType: 'TOURNAMENT', scopeId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { targetId: true, afterData: true },
        take: 10,
      }),
      db.fixture.findMany({
        where: { tournamentId: id }, orderBy: { sequence: 'asc' },
        select: { id: true, sequence: true, updatedAt: true, publishedAt: true, roundName: true, homeRegistrationId: true, awayRegistrationId: true },
      }),
    ]);
    const players = new Map(eligible.map(user => [user.id, toPlayer(user)]));
    const assigned = new Set(entries.flatMap(entry => entry.members.map(member => member.userId)));
    return {
      tournament, editable: isEditable(tournament), fixtures,
      publishedFixtureCount: fixtures.filter(fixture => fixture.publishedAt).length,
      revision: createHash('sha256').update(JSON.stringify({
        tournament, fixtures, entries, eligibility: entries.flatMap(entry => entry.members.map(member => players.has(member.userId))),
      })).digest('hex'),
        availablePlayers: [...players.values()].filter(player => !assigned.has(player.id)).sort((a, b) => a.name.localeCompare(b.name)),
        entries: liveEntries(entries).map(entry => ({
          id: entry.id, name: entry.entryName, logo: entry.entryLogoUrl, groupId: entry.groupId, status: entry.status,
          captainId: entry.registeredByUserId,
          members: entry.members.map(member => players.get(member.userId) ?? { id: member.userId, name: 'Ineligible player', avatar: null }),
          valid: validEntry(entry, tournament.teamSize, playerId => players.has(playerId)),
        })),
        history: draws.map(draw => ({ requestId: draw.targetId, outcome: draw.afterData })),
    };
  }

  async publish(userId: string, id: string, dto: PublishStudioDto) {
    if (!dto.confirmed) throw new BadRequestException('Confirm the reviewed fixtures before publishing.');
    await this.auth.assertCanManageTournamentPermission(userId, id, 'MANAGE_SETTINGS');
    await this.auth.assertCanManageTournamentPermission(userId, id, 'MANAGE_PARTICIPANTS');
    await this.auth.assertCanManageFixtures(userId, id);
    const result = await this.prisma.$transactionWithRetry(async tx => {
      await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${id}::uuid FOR UPDATE`;
      const auditKey = { action: 'TOURNAMENT_STUDIO_PUBLISHED', targetType: 'Tournament', targetId: id, scopeType: 'TOURNAMENT', scopeId: id };
      const prior = await tx.auditLog.findFirst({ where: auditKey });
      if (prior && prior.actorUserId === userId && (prior.metadata as { revision?: string } | null)?.revision === dto.revision) {
        return prior.afterData;
      }
      const state = await this.snapshot(tx, id);
      if (state.revision !== dto.revision) throw new ConflictException('The roster, settings or fixtures changed. Reload the review and confirm the updated preview.');
      if (state.entries.some(entry => entry.status === 'PENDING' || !entry.valid)) {
        throw new ConflictException('Resolve all pending registrations and fix ineligible or incomplete entries before publishing.');
      }
      if (!state.fixtures.length || state.publishedFixtureCount && state.publishedFixtureCount !== state.fixtures.length) {
        throw new ConflictException('Review a complete fixture preview before publishing.');
      }
      if (!state.publishedFixtureCount) await this.preview.publishFixtures(userId, id, {}, tx);
      const published = await this.finalize.publishTournament(userId, id, tx);
      const outcome = { id, name: published.data.tournament.name, fixtureCount: state.fixtures.length };
      await tx.auditLog.create({ data: { ...auditKey, actorUserId: userId, metadata: { revision: dto.revision }, afterData: outcome } });
      return outcome;
    }, { isolationLevel: 'Serializable', timeout: 120000 });
    return { success: true, data: result, error: null };
  }

  async draw(userId: string, id: string, dto: TournamentDrawDto) {
    await this.auth.assertCanManageTournamentPermission(userId, id, 'MANAGE_PARTICIPANTS');
    if (dto.kind === 'GROUP') await this.auth.assertCanManageFixtures(userId, id);
    if (dto.poolPlayerIds && dto.kind !== 'PLAYER' && dto.kind !== 'AUTO') {
      throw new BadRequestException('The player pool is only used for random player draws.');
    }
    const fingerprint = JSON.stringify(Object.entries(dto).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b)));
    const result = await this.prisma.$transactionWithRetry(async tx => {
      await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${id}::uuid FOR UPDATE`;
      const prior = await tx.auditLog.findFirst({
        where: { action, targetType, targetId: dto.requestId, scopeType: 'TOURNAMENT', scopeId: id },
      });
      if (prior) {
        if (prior.actorUserId !== userId || (prior.metadata as { fingerprint?: string } | null)?.fingerprint !== fingerprint) {
          throw new ConflictException('This request was already used for a different draw.');
        }
        return prior.afterData;
      }
      const tournament = await this.tournament(tx, id);
      if (!isEditable(tournament)) throw new ConflictException('Draws are locked once fixture generation or publication starts.');
      const entries = await this.entries(tx, id);
      const entry = dto.entryId ? entries.find(item => item.id === dto.entryId && item.status === 'APPROVED') : undefined;
      if (dto.entryId && !entry) throw new BadRequestException('Choose an approved entry in this tournament.');
      const players = await this.eligible(tx, tournament.leagueId);
      let outcome: Prisma.InputJsonObject;
      if (dto.kind === 'CLUB') {
        if (!entry) throw new BadRequestException('Choose an approved entry before drawing its club.');
        if (!validEntry(entry, tournament.teamSize, playerId => players.some(player => player.id === playerId))) {
          throw new BadRequestException('Fix this entry’s roster before drawing its club.');
        }
        if (entry.entryName) requireReason(dto.reason);
        outcome = await this.clubDraw(tx, dto, entries, entry);
      } else if (dto.kind === 'GROUP') {
        outcome = await this.groupDraw(tx, tournament, entries, new Set(players.map(player => player.id)), dto);
      } else {
        if (entry && dto.kind !== 'MANUAL') throw new BadRequestException('Use manual assignment to edit an existing entry.');
        if (entry) requireReason(dto.reason);
        outcome = await this.assignPlayers(tx, userId, tournament, entries, players, dto, entry);
      }
      // A revision write forces stale serializable snapshots behind the lock to retry.
      await tx.tournament.update({ where: { id }, data: { updatedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          action, targetType, targetId: dto.requestId, scopeType: 'TOURNAMENT', scopeId: id, actorUserId: userId,
          beforeData: entry ? { id: entry.id, name: entry.entryName, captainId: entry.registeredByUserId, playerIds: entry.members.map(member => member.userId) } : undefined,
          afterData: outcome,
          metadata: { fingerprint, reason: dto.reason?.trim() || null },
        },
      });
      return outcome;
    }, { isolationLevel: 'Serializable', timeout: 30000 });
    return { success: true, data: result, error: null };
  }

  private async assignPlayers(
    tx: Prisma.TransactionClient, actor: string, tournament: StudioTournament, entries: Entry[],
    players: PlayerUser[], dto: TournamentDrawDto, entry?: Entry,
  ): Promise<Prisma.InputJsonObject> {
    const reserved = new Set(entries.filter(item => item.id !== entry?.id).flatMap(item => item.members.map(member => member.userId)));
    const playerMap = new Map(players.filter(player => !reserved.has(player.id)).map(player => [player.id, toPlayer(player)]));
    const available = dto.poolPlayerIds ?? [...playerMap.keys()];
    const remaining = tournament.maxEntries - liveEntries(entries).length;
    if (!entry && remaining < 1) throw new ConflictException('Registration capacity is full. Increase the entry limit or remove an entry first.');
    const size = tournament.teamSize;
    const requested = dto.playerIds ?? [];
    let squads: string[][];
    if (dto.kind === 'MANUAL') {
      if (requested.length !== size || new Set(requested).size !== size) throw new BadRequestException('Choose exactly ' + size + ' distinct eligible players.');
      if (requested.some(id => !playerMap.has(id))) throw new ConflictException('One or more players are assigned already or are no longer eligible.');
      squads = [requested];
    } else {
      if (requested.length) throw new BadRequestException('Clear manual picks before drawing from the available players.');
      if (dto.poolPlayerIds) {
        if (available.length > remaining * size) throw new BadRequestException('The selected pool exceeds the remaining entry capacity.');
        if (available.some(id => !playerMap.has(id))) {
          throw new ConflictException('Some selected players are already assigned or no longer eligible. Refresh the pool and try again.');
        }
      }
      const shuffled = shuffle(available);
      const count = Math.min(dto.kind === 'PLAYER' ? 1 : remaining, Math.floor(shuffled.length / size));
      if (!count) throw new BadRequestException('The draw needs ' + size + ' available players to complete an entry.');
      squads = Array.from({ length: count }, (_, index) => shuffled.slice(index * size, (index + 1) * size));
    }
    if (dto.captainId && (!squads[0]?.includes(dto.captainId) || dto.kind !== 'MANUAL')) {
      throw new BadRequestException('Choose a captain from the selected players.');
    }

    const name = dto.kind === 'MANUAL' ? dto.name?.trim() || null : null;
    if (name && liveEntries(entries).some(item => item.id !== entry?.id && item.entryName &&
      normalizeEntryName(item.entryName) === normalizeEntryName(name))) {
      throw new ConflictException('An entry already uses that club or team name.');
    }
    let sortOrder = Math.max(0, ...entries.map(item => item.sortOrder));
    const created = [];
    for (const squad of squads) {
      const members = squad.map(playerId => playerMap.get(playerId)!);
      const captainId = dto.captainId ?? squad[0]!;
      const roster = squad.map(userId => ({ tournamentId: tournament.id, userId }));
      if (entry) await tx.tournamentRegistrationMember.deleteMany({ where: { registrationId: entry.id } });
      const record = entry
        ? await tx.tournamentRegistration.update({
          where: { id: entry.id },
          data: { entryName: name, entryLogoUrl: name === entry.entryName ? undefined : null, registeredByUserId: captainId, members: { create: roster } },
        })
        : await tx.tournamentRegistration.create({
          data: {
            tournamentId: tournament.id, registeredByUserId: captainId, status: 'APPROVED', reviewedByUserId: actor,
            reviewedAt: new Date(), entryName: name, sortOrder: ++sortOrder, members: { create: roster },
          },
        });
      created.push({ id: record.id, name: name ?? members.map(member => member.name).join(' + '), members, captainId });
    }
    return {
      kind: dto.kind, entries: created, unassigned: available.length - squads.length * size,
      ...(dto.kind === 'PLAYER' ? { options: available.map(playerId => playerMap.get(playerId)!) } : {}),
    };
  }

  private async clubDraw(tx: Prisma.TransactionClient, dto: TournamentDrawDto, entries: Entry[], entry: Entry): Promise<Prisma.InputJsonObject> {
    const taken = new Set(liveEntries(entries).filter(item => item.entryName).map(item => normalizeEntryName(item.entryName!)));
    const pool = new Map<string, string>();
    for (const club of dto.clubs ?? []) {
      const key = normalizeEntryName(club);
      if (key && !taken.has(key) && !pool.has(key)) pool.set(key, club.trim());
    }
    const options = [...pool.values()];
    if (!options.length) throw new BadRequestException('Enter at least one club or team name that is still available.');
    const winner = options[randomInt(options.length)]!;
    await tx.tournamentRegistration.update({ where: { id: entry.id }, data: { entryName: winner, entryLogoUrl: null } });
    return { kind: 'CLUB', entryId: entry.id, winner, options };
  }

  private async groupDraw(
    tx: Prisma.TransactionClient, tournament: StudioTournament, allEntries: Entry[], eligible: Set<string>, dto: TournamentDrawDto,
  ): Promise<Prisma.InputJsonObject> {
    if (tournament.groupMode !== 'MULTIPLE_GROUPS' || tournament.competitionFormat !== 'GROUP_STAGE_KNOCKOUT') {
      throw new BadRequestException('Group Draw is available for Group + Knockout tournaments.');
    }
    const entries = allEntries.filter(entry => entry.status === 'APPROVED');
    if (entries.some(entry => !validEntry(entry, tournament.teamSize, id => eligible.has(id)))) {
      throw new BadRequestException('Fix each approved entry’s roster and eligibility before drawing groups.');
    }
    if (entries.some(entry => entry.groupId)) requireReason(dto.reason);
    const existing = tournament.groups;
    const groupCount = dto.groupCount ?? (existing.length || (entries.length === 42 ? 7 : 2));
    if (groupCount < 2 || groupCount > 16 || entries.length < groupCount * 2) {
      throw new BadRequestException('Choose 2–16 groups with at least two approved entries per group.');
    }
    if (existing.length && groupCount !== existing.length) throw new BadRequestException('Use the group editor to change the number of configured groups.');
    const groups = existing.length ? existing : await Promise.all(Array.from({ length: groupCount }, (_, index) =>
      tx.tournamentGroup.create({ data: { tournamentId: tournament.id, name: 'Group ' + String.fromCharCode(65 + index), position: index + 1 } }),
    ));
    const placements: { id: string; name: string; entryIds: string[] }[] = groups.map(group => ({ id: group.id, name: group.name, entryIds: [] }));
    shuffle(entries).forEach((entry, index) => placements[index % groupCount]!.entryIds.push(entry.id));
    assertBalancedGroupCounts(placements.map(group => ({ name: group.name, count: group.entryIds.length })), 0);
    const smallestGroup = Math.min(...placements.map(group => group.entryIds.length));
    if (tournament.qualifiersPerGroup && tournament.qualifiersPerGroup > smallestGroup) {
      throw new BadRequestException('Qualification places exceed the smallest group size.');
    }
    for (const group of placements) {
      await tx.tournamentRegistration.updateMany({ where: { tournamentId: tournament.id, id: { in: group.entryIds } }, data: { groupId: group.id } });
    }
    return { kind: 'GROUP', groups: placements, previousGroups: entries.map(entry => ({ id: entry.id, groupId: entry.groupId })) };
  }
}

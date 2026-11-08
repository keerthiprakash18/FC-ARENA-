import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../database/prisma.service.js';
import { AuthorizationService } from '../security/authorization.service.js';
import { assertBalancedGroups, planGroupRebalance } from './group-balance.js';
import { generateDoubleRoundRobinFixtures, generateRoundRobinFixtures } from './fixture-engine.js';

type ProposedMove = { registrationId: string; groupId: string | null };

/**
 * Transactional admin group editor. Only the affected, never-played group
 * fixtures are regenerated; all other fixtures and their IDs stay untouched.
 */
@Injectable()
export class SafeGroupEditorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async move(
    userId: string,
    tournamentId: string,
    registrationId: string,
    groupId: string | null,
  ) {
    return this.apply(userId, tournamentId, [{ registrationId, groupId }]);
  }

  async rebalance(userId: string, tournamentId: string) {
    return this.apply(userId, tournamentId, null);
  }

  async swap(
    userId: string,
    tournamentId: string,
    registrationId: string,
    otherRegistrationId: string,
  ) {
    if (registrationId === otherRegistrationId) {
      this.conflict('SWAP_REQUIRES_DISTINCT_TEAMS', 'Choose two different teams to swap.');
    }
    return this.apply(userId, tournamentId, null, [registrationId, otherRegistrationId]);
  }

  private async apply(
    userId: string,
    tournamentId: string,
    requested: ProposedMove[] | null,
    swapRegistrationIds: [string, string] | null = null,
  ) {
    await this.authorization.assertCanManageTournamentPermission(
      userId, tournamentId, 'MANAGE_PARTICIPANTS',
    );
    // Fixture permission is necessary even for a group move when it changes
    // existing official fixture records.
    await this.authorization.assertCanManageTournamentPermission(
      userId, tournamentId, 'MANAGE_FIXTURES',
    );

    const result = await this.prisma.$transactionWithRetry(async (tx) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
        select: {
          id: true, status: true, groupMode: true,
          competitionFormat: true, legType: true, fixturesPublishedAt: true,
        },
      });
      if (!tournament) {
        throw new NotFoundException('Tournament not found.');
      }
      if (tournament.groupMode !== 'MULTIPLE_GROUPS' ||
        ['COMPLETED', 'CANCELLED'].includes(tournament.status)) {
        this.conflict('GROUP_EDIT_UNAVAILABLE', 'This tournament does not allow group editing.');
      }

      const [groups, registrations, fixtureCount] = await Promise.all([
        tx.tournamentGroup.findMany({
          where: { tournamentId }, orderBy: { position: 'asc' },
          select: { id: true, name: true },
        }),
        tx.tournamentRegistration.findMany({
          where: { tournamentId, status: 'APPROVED' },
          select: { id: true, groupId: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        }),
        tx.fixture.count({ where: { tournamentId } }),
      ]);
      const groupIds = new Set(groups.map((g) => g.id));
      const byEntry = new Map(registrations.map((r) => [r.id, r]));
      const plan = groups.map((g) => ({
        ...g, registrations: registrations.filter((r) => r.groupId === g.id).map((r) => ({ id: r.id })),
      }));
      let wanted: ProposedMove[];
      if (swapRegistrationIds) {
        const [firstId, secondId] = swapRegistrationIds;
        const first = byEntry.get(firstId);
        const second = byEntry.get(secondId);
        if (!first || !second) {
          this.conflict('REGISTRATION_NOT_APPROVED', 'Choose two approved teams to swap.');
        }
        if (!first!.groupId || !second!.groupId ||
          first!.groupId === second!.groupId) {
          this.conflict('SWAP_REQUIRES_DIFFERENT_GROUPS',
            'Choose two assigned teams from different groups.');
        }
        wanted = [
          { registrationId: firstId, groupId: second!.groupId },
          { registrationId: secondId, groupId: first!.groupId },
        ];
      } else {
        wanted = requested ?? planGroupRebalance(
          plan, registrations.filter((r) => !r.groupId).map((r) => r.id),
        ).map(({ registrationId, groupId }) => ({ registrationId, groupId }));
      }

      const seen = new Set<string>();
      const changes: Array<{ registrationId: string; fromGroupId: string | null; groupId: string | null }> = [];
      for (const move of wanted) {
        const current = byEntry.get(move.registrationId);
        if (!current) this.conflict('REGISTRATION_NOT_APPROVED', 'Only approved teams in this tournament can be moved.');
        if (seen.has(move.registrationId)) {
          this.conflict('DUPLICATE_GROUP_ENTRY', 'A team can only be moved once per edit.');
        }
        seen.add(move.registrationId);
        if (move.groupId !== null && !groupIds.has(move.groupId)) {
          this.conflict('INVALID_GROUP', 'Destination group does not belong to this tournament.');
        }
        if (current!.groupId !== move.groupId) {
          changes.push({ registrationId: move.registrationId, fromGroupId: current!.groupId, groupId: move.groupId });
        }
      }
      if (!changes.length) {
        return { changedTeams: 0, regeneratedFixtures: 0, affectedGroups: [] as string[] };
      }

      const destination = new Map(changes.map((c) => [c.registrationId, c.groupId]));
      const afterGroups = groups.map((g) => ({
        ...g,
        registrations: registrations
          .filter((r) => (destination.has(r.id) ? destination.get(r.id) : r.groupId) === g.id)
          .map((r) => ({ id: r.id })),
      }));
      const impacted = [...new Set(changes.flatMap((c) => [c.fromGroupId, c.groupId])
        .filter((id): id is string => id !== null))];
      let regeneratedFixtures = 0;

      if (fixtureCount > 0) {
        // Never leave an already-generated tournament in an invalid draw state.
        assertBalancedGroups(afterGroups, registrations.length);
        const incompatible = await tx.fixture.count({
          where: { tournamentId, OR: [{ phase: 'PLAYOFF' }, { groupId: null }] },
        });
        if (incompatible) {
          this.conflict('PLAYOFFS_OR_CUSTOM_FIXTURES_LOCKED',
            'Playoff or non-group fixtures exist. Editing groups could corrupt progression.');
        }

        const fixtures = await tx.fixture.findMany({
          where: { tournamentId, phase: 'STAGE', groupId: { in: impacted } },
          include: {
            deadlineCase: { select: { id: true } },
            match: {
              include: {
                _count: { select: {
                  resultSubmissions: true, ocrExtractions: true,
                  statEvents: true, disputes: true,
                } },
              },
            },
          },
        });
        const unsafe = fixtures.some((f) =>
          f.status !== 'UNSCHEDULED' || !!f.scheduledAt ||
          !!f.resultDeadlineAt || !!f.venue || !!f.deadlineCase ||
          !!f.nextFixtureId || !!f.loserNextFixtureId ||
          (f.match && (
            f.match.status !== 'UNSCHEDULED' ||
            !!f.match.confirmedResultSubmissionId ||
            !!f.match.homeReadyAt || !!f.match.awayReadyAt ||
            Object.values(f.match._count).some((n) => n > 0)
          )),
        );
        if (unsafe) {
          this.conflict('GROUP_FIXTURES_HAVE_ACTIVITY',
            'A selected group contains scheduled, played, ready, disputed or submitted matches. Group changes are blocked to protect match IDs, dates and results.');
        }

        const publishedAt = fixtures.find((f) => f.publishedAt)?.publishedAt ??
          tournament.fixturesPublishedAt;
        const createMatches = fixtures.some((f) => !!f.match) || !!publishedAt;
        const publishedByGroup = new Map(impacted.map((groupId) => [
          groupId, fixtures.find((f) => f.groupId === groupId && f.publishedAt)?.publishedAt ?? publishedAt,
        ] as const));

        await tx.fixture.deleteMany({
          where: { tournamentId, phase: 'STAGE', groupId: { in: impacted } },
        });
        for (const change of changes) {
          await tx.tournamentRegistration.update({
            where: { id: change.registrationId }, data: { groupId: change.groupId },
          });
        }

        const last = await tx.fixture.findFirst({
          where: { tournamentId }, orderBy: { sequence: 'desc' },
          select: { sequence: true },
        });
        let sequence = last?.sequence ?? 0;
        const doubleLeg = tournament.competitionFormat === 'DOUBLE_ROUND_ROBIN' ||
          tournament.legType === 'HOME_AWAY';
        for (const group of afterGroups.filter((g) => impacted.includes(g.id))) {
          const ids = group.registrations.map((entry) => entry.id);
          const blueprints = doubleLeg
            ? generateDoubleRoundRobinFixtures(ids)
            : generateRoundRobinFixtures(ids);
          for (const blueprint of blueprints) {
            const fixture = await tx.fixture.create({
              data: {
                fixtureCode: `FCA-F-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`,
                tournamentId, groupId: group.id, sequence: ++sequence,
                matchday: blueprint.matchday, roundNumber: blueprint.roundNumber,
                roundName: `${group.name} - ${blueprint.roundName}`,
                bracketPosition: blueprint.bracketPosition,
                homeRegistrationId: blueprint.homeRegistrationId,
                awayRegistrationId: blueprint.awayRegistrationId,
                publishedAt: publishedByGroup.get(group.id) ?? null,
              },
            });
            if (createMatches) {
              const match = await tx.match.create({ data: { tournamentId, fixtureId: fixture.id } });
              await tx.match.update({
                where: { id: match.id },
                data: { matchCode: `FCA-M-${String(match.serialNumber).padStart(6, '0')}` },
              });
            }
            regeneratedFixtures++;
          }
        }
      } else {
        for (const change of changes) {
          await tx.tournamentRegistration.update({
            where: { id: change.registrationId }, data: { groupId: change.groupId },
          });
        }
      }
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: swapRegistrationIds ? 'TOURNAMENT_GROUP_SWAP'
            : requested ? 'TOURNAMENT_GROUP_MOVE' : 'TOURNAMENT_GROUP_REBALANCE',
          targetType: 'Tournament',
          targetId: tournamentId,
          scopeType: 'TOURNAMENT',
          scopeId: tournamentId,
          beforeData: changes.map(({ registrationId, fromGroupId }) => ({ registrationId, groupId: fromGroupId })),
          afterData: changes.map(({ registrationId, groupId }) => ({ registrationId, groupId })),
          metadata: { affectedGroupIds: impacted, regeneratedFixtures },
        },
      });
      return { changedTeams: changes.length, regeneratedFixtures, affectedGroups: impacted };
    }, { isolationLevel: 'Serializable', timeout: 30000 });

    return {
      success: true,
      data: {
        ...result,
        message: result.changedTeams
          ? `${result.changedTeams} team(s) updated. ${result.regeneratedFixtures} affected group fixture(s) regenerated; unrelated fixtures were preserved.`
          : 'Groups are already balanced. No changes needed.',
      },
      error: null,
    };
  }

  private conflict(code: string, message: string): never {
    throw new ConflictException({ success: false, data: null, error: { code, message } });
  }
}

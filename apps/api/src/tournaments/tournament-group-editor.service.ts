import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuthorizationService } from '../security/authorization.service.js';
import { planGroupFixtureChanges, isProtectedGroupFixture } from './group-fixture-reconciliation.js';
import type { GroupChangePreview, GroupEditInput, GroupEditorState } from './group-editor.types.js';
import { usesBestThirdPlayoffs } from './best-third-playoffs.js';

type Client = Prisma.TransactionClient;
const fail = (code: string, message: string) => new ConflictException({ success: false, data: null, error: { code, message } });
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

@Injectable()
export class TournamentGroupEditorService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService) {}

  private async snapshot(client: Client, tournamentId: string) {
    const tournament = await client.tournament.findUnique({ where: { id: tournamentId }, select: {
      id: true, name: true, code: true, leagueId: true, status: true, groupMode: true, format: true, competitionFormat: true,
      legType: true, maxEntries: true, qualifiersPerGroup: true, playoffQualifiersTotal: true, playoffSource: true,
      playoffFormat: true, playoffSeedingBasis: true,
      fixturesGeneratedAt: true, fixturesPublishedAt: true, updatedAt: true,
    } });
    if (!tournament) throw new NotFoundException('Tournament could not be found.');
    const [groups, entries, fixtures] = await Promise.all([
      client.tournamentGroup.findMany({ where: { tournamentId }, orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
      client.tournamentRegistration.findMany({ where: { tournamentId, status: 'APPROVED' }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }], select: {
        id: true, entryName: true, entryLogoUrl: true, groupId: true, updatedAt: true, members: { orderBy: { userId: 'asc' }, select: { user: { select: { id: true, fullName: true, player: { select: { playerCode: true, identity: { select: { inGameName: true } } } } } } } },
      } }),
      client.fixture.findMany({ where: { tournamentId }, orderBy: [{ sequence: 'asc' }, { id: 'asc' }], include: {
        deadlineCase: { select: { id: true } }, match: { include: { arenaPost: { select: { id: true } }, _count: { select: { resultSubmissions: true, statEvents: true, ocrExtractions: true, disputes: true } } } },
      } }),
    ]);
    return { tournament, groups, entries, fixtures, revision: digest({ tournament, groups, entries, fixtures }) };
  }

  private async policy(client: Client, userId: string, s: Awaited<ReturnType<TournamentGroupEditorService['snapshot']>>) {
    const auth = client === this.prisma ? this.authorization : new AuthorizationService(client as unknown as PrismaService);
    const canManage = await auth.hasTournamentPermission(userId, s.tournament.id, 'MANAGE_PARTICIPANTS');
    const fixturesPermission = !s.fixtures.length || await auth.hasTournamentPermission(userId, s.tournament.id, 'MANAGE_FIXTURES');
    let membershipReason: string | null = null;
    if (!canManage) membershipReason = 'Tournament participant-management permission is required to edit groups.';
    else if (s.tournament.groupMode !== 'MULTIPLE_GROUPS' || s.tournament.format !== 'ROUND_ROBIN') membershipReason = 'Enable a multiple-group round-robin stage in Tournament Setup to arrange groups.';
    else if (['COMPLETED', 'CANCELLED'].includes(s.tournament.status)) membershipReason = 'This competition is finished. Group names can still be corrected; its final participants and results are preserved.';
    else if (!fixturesPermission) membershipReason = 'Updating generated pairings also requires Manage Fixtures permission.';
    else if (s.fixtures.some(f => f.phase === 'PLAYOFF')) membershipReason = 'The playoff bracket already depends on these groups. Group names can still be edited; use the protected playoff reset before changing group membership.';
    return { canManage, canChangeMembership: membershipReason === null, membershipReason };
  }

  private async state(client: Client, userId: string, s: Awaited<ReturnType<TournamentGroupEditorService['snapshot']>>): Promise<GroupEditorState> {
    const policy = await this.policy(client, userId, s);
    const entries = s.entries.map(entry => ({ id: entry.id, name: entry.entryName || entry.members.map(m => m.user.player?.identity?.inGameName || m.user.fullName).join(' + ') || 'Tournament Entry', logoUrl: entry.entryLogoUrl,
      members: entry.members.map(m => ({ id: m.user.id, name: m.user.player?.identity?.inGameName || m.user.fullName, playerCode: m.user.player?.playerCode ?? null })) }));
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    return { revision: s.revision, tournament: { id: s.tournament.id, name: s.tournament.name, code: s.tournament.code, leagueId: s.tournament.leagueId, status: s.tournament.status, groupMode: s.tournament.groupMode, legType: s.tournament.legType, maxEntries: s.tournament.maxEntries, hasFixtures: s.fixtures.length > 0 }, ...policy,
      protectedEntryIds: [...new Set(s.fixtures.filter(isProtectedGroupFixture).flatMap(f => [f.homeRegistrationId, f.awayRegistrationId]).filter((id): id is string => Boolean(id)))],
      groups: s.groups.map(group => ({ id: group.id, name: group.name, position: group.position, entries: s.entries.filter(entry => entry.groupId === group.id).map(entry => byId.get(entry.id)!) })),
      unassigned: s.entries.filter(entry => !entry.groupId || !s.groups.some(g => g.id === entry.groupId)).map(entry => byId.get(entry.id)!),
    };
  }

  async getEditor(userId: string, tournamentId: string) {
    const meta = await this.prisma.tournament.findUnique({ where: { id: tournamentId }, select: { leagueId: true } });
    if (!meta) throw new NotFoundException('Tournament could not be found.');
    const membership = await this.prisma.leagueMember.findUnique({ where: { leagueId_userId: { leagueId: meta.leagueId, userId } }, select: { id: true } });
    if (!membership) throw new ForbiddenException('League membership is required to view these groups.');
    const s = await this.snapshot(this.prisma, tournamentId);
    return { success: true, data: { editor: await this.state(this.prisma, userId, s) }, error: null };
  }

  private async prepare(client: Client, userId: string, tournamentId: string, input: GroupEditInput) {
    const auth = client === this.prisma ? this.authorization : new AuthorizationService(client as unknown as PrismaService);
    await auth.assertCanManageTournamentPermission(userId, tournamentId, 'MANAGE_PARTICIPANTS');
    const s = await this.snapshot(client, tournamentId), policy = await this.policy(client, userId, s);
    if (!policy.canManage) throw new ForbiddenException('Manage Participants permission is required to edit groups.');
    if (s.revision !== input.revision) throw fail('GROUP_INPUTS_CHANGED', 'Groups, entries or match activity changed. Reload the latest groups and review your changes again.');
    if (input.groups.length < 2 || input.groups.length > 16) throw new BadRequestException('Choose between two and sixteen groups.');
    const desired = input.groups.map((group, index) => ({ id: group.id, name: group.name.trim(), position: index + 1, registrationIds: [...group.registrationIds] }));
    if (new Set(desired.map(g => g.id)).size !== desired.length || desired.some(g => !g.name || g.name.length > 40) || new Set(desired.map(g => g.name.normalize('NFKC').toLocaleLowerCase())).size !== desired.length) throw new BadRequestException('Use unique group IDs and non-empty, distinct group names up to 40 characters.');
    const approved = new Set(s.entries.map(entry => entry.id)), assigned = desired.flatMap(g => g.registrationIds);
    const sameMembership = desired.length === s.groups.length && desired.every(g => s.groups.some(old => old.id === g.id) && JSON.stringify([...g.registrationIds].sort()) === JSON.stringify(s.entries.filter(e => e.groupId === g.id).map(e => e.id).sort()));
    if ((!sameMembership && assigned.length !== approved.size) || new Set(assigned).size !== assigned.length || assigned.some(id => !approved.has(id))) throw fail('GROUP_ROSTER_INCOMPLETE', 'Assign every approved team exactly once. Unapproved teams and teams from another tournament cannot be included.');
    const oldById = new Map(s.groups.map(g => [g.id, g]));
    const destination = new Map<string, string | null>(desired.flatMap(g => g.registrationIds.map(id => [id, g.id] as const)));
    if (sameMembership) for (const entry of s.entries) if (!destination.has(entry.id)) destination.set(entry.id, entry.groupId);
    const movedTeams = s.entries.filter(entry => destination.get(entry.id) !== entry.groupId).length;
    const newGroups = desired.filter(g => !oldById.has(g.id)), removedGroups = s.groups.filter(g => !desired.some(n => n.id === g.id));
    const membershipChanged = movedTeams > 0 || newGroups.length > 0 || removedGroups.length > 0;
    if (membershipChanged) {
      if (!policy.canChangeMembership) throw fail('GROUP_MEMBERSHIP_PROTECTED', policy.membershipReason!);
      const sizes = desired.map(g => g.registrationIds.length);
      if (usesBestThirdPlayoffs(s.tournament) && (sizes.length !== 7 || sizes.some(size => size !== 6))) {
        throw fail('GROUP_QUALIFICATION_INVALID', 'The Round of 16 format requires seven groups of six teams.');
      }
      if (Math.min(...sizes) < 2 || Math.max(...sizes) - Math.min(...sizes) > 1) throw fail('GROUPS_UNBALANCED', 'Use Auto-balance: each group needs at least two teams and group sizes may differ by at most one.');
      if (s.tournament.playoffSource === 'GROUP_QUALIFIERS' && s.tournament.qualifiersPerGroup && desired.some(g => g.registrationIds.length < s.tournament.qualifiersPerGroup!)) throw fail('GROUP_QUALIFICATION_INVALID', 'Each group must contain at least the configured number of qualifiers. Update Qualification settings before using fewer teams per group.');
      if (newGroups.length && await client.tournamentGroup.count({ where: { id: { in: newGroups.map(g => g.id) } } })) throw new BadRequestException('New group IDs must be unique to this tournament.');
    }
    const oldSizes = Object.fromEntries(s.groups.map(g => [g.id, s.entries.filter(e => e.groupId === g.id).length]));
    const affected = new Set<string>();
    for (const entry of s.entries) if (destination.get(entry.id) !== entry.groupId) { if (entry.groupId) affected.add(entry.groupId); affected.add(destination.get(entry.id)!); }
    for (const group of [...newGroups, ...removedGroups]) affected.add(group.id);
    const stage = s.fixtures.filter(f => f.phase === 'STAGE');
    if (membershipChanged && stage.some(f => !f.groupId)) throw fail('UNGROUPED_STAGE_FIXTURES', 'Existing stage fixtures are missing their group. Repair or reset that preview before changing group membership.');
    const affectedFixtures = stage.filter(f => f.groupId && affected.has(f.groupId));
    const plan = membershipChanged && stage.length ? planGroupFixtureChanges({ groups: desired.filter(g => affected.has(g.id)), oldGroupSizes: oldSizes, fixtures: affectedFixtures,
      legType: s.tournament.competitionFormat === 'DOUBLE_ROUND_ROBIN' ? 'HOME_AWAY' : s.tournament.legType }) : { updates: [], creates: [], removeFixtureIds: [] };
    const renamed = desired.filter(g => oldById.has(g.id) && oldById.get(g.id)!.name !== g.name);
    const reslotted = plan.updates.filter(update => { const old = s.fixtures.find(f => f.id === update.id)!; return old.groupId !== update.groupId || old.roundNumber !== update.roundNumber || old.matchday !== update.matchday || old.bracketPosition !== update.bracketPosition || old.roundName !== update.roundName; });
    const preview: GroupChangePreview = { revision: s.revision, planHash: digest({ revision: s.revision, groups: desired, plan }), membershipChanged,
      groups: desired.map(g => ({ id: g.id, name: g.name, teams: g.registrationIds.length })),
      impact: { movedTeams, newGroups: newGroups.length, deletedGroups: removedGroups.length, renamedGroups: renamed.length, fixturesKept: s.fixtures.length - plan.removeFixtureIds.length, fixturesRemoved: plan.removeFixtureIds.length, fixturesCreated: plan.creates.length, fixturesReslotted: reslotted.length, resultsPreserved: s.fixtures.filter(f => f.match?.confirmedResultSubmissionId).length } };
    return { s, desired, newGroups, removedGroups, destination, renamed, plan, reslotted, preview };
  }

  async preview(userId: string, tournamentId: string, input: GroupEditInput) {
    const { preview } = await this.prisma.$transactionWithRetry(tx => this.prepare(tx, userId, tournamentId, input), { isolationLevel: 'Serializable', timeout: 30000 });
    return { success: true, data: { preview }, error: null };
  }

  async apply(userId: string, tournamentId: string, input: GroupEditInput & { planHash: string }) {
    const result = await this.prisma.$transactionWithRetry(async tx => {
      await new AuthorizationService(tx as unknown as PrismaService).assertCanManageTournamentPermission(userId, tournamentId, 'MANAGE_PARTICIPANTS');
      // FK key-share locks taken by new registrations/results must not race a
      // cascading fixture removal. Lock before reading the reviewed snapshot.
      await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${tournamentId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM tournament_registrations WHERE "tournamentId" = ${tournamentId}::uuid ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM fixtures WHERE "tournamentId" = ${tournamentId}::uuid ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM matches WHERE "tournamentId" = ${tournamentId}::uuid ORDER BY id FOR UPDATE`;
      const prepared = await this.prepare(tx, userId, tournamentId, input);
      const { s, desired, newGroups, removedGroups, destination, renamed, plan, reslotted, preview } = prepared;
      if (input.planHash !== preview.planHash) throw fail('GROUP_PLAN_CHANGED', 'This is not the reviewed group plan. Preview the current changes before saving.');
      // Names and positions are unique per tournament. Temporary values allow
      // atomic reordering/renaming without ever exposing an incomplete draw.
      for (const group of s.groups) {
        const next = desired.find(g => g.id === group.id);
        if (!next || next.name !== group.name || next.position !== group.position) await tx.tournamentGroup.update({ where: { id: group.id }, data: { name: '~' + group.id, position: -group.position - 1 } });
      }
      for (const group of newGroups) await tx.tournamentGroup.create({ data: { id: group.id, tournamentId, name: group.name, position: group.position } });
      for (const entry of s.entries) if (entry.groupId !== destination.get(entry.id)) await tx.tournamentRegistration.update({ where: { id: entry.id }, data: { groupId: destination.get(entry.id)! } });
      if (plan.removeFixtureIds.length) {
        const removedMatchIds = s.fixtures.filter(f => plan.removeFixtureIds.includes(f.id) && f.match).map(f => f.match!.id);
        await tx.notification.deleteMany({ where: { OR: [ { entityType: { equals: 'Fixture', mode: 'insensitive' }, entityId: { in: plan.removeFixtureIds } }, { entityType: { equals: 'Match', mode: 'insensitive' }, entityId: { in: removedMatchIds } }, { href: { in: [...removedMatchIds.map(id => '/matches/' + id), ...plan.removeFixtureIds.map(id => '/fixtures/' + id)] } } ] } });
        await tx.fixture.deleteMany({ where: { tournamentId, id: { in: plan.removeFixtureIds } } });
      }
      for (const update of reslotted) { const { id, ...data } = update; await tx.fixture.update({ where: { id }, data }); }
      // A name correction is safe at every stage, including after completion.
      // Update the displayed group prefix without touching any score or pairing.
      for (const group of renamed) {
        const previous = s.groups.find(g => g.id === group.id)!;
        for (const fixture of s.fixtures.filter(f => f.groupId === group.id && !plan.removeFixtureIds.includes(f.id) && !reslotted.some(row => row.id === f.id))) {
          const prefix = previous.name + ' - ';
          if (fixture.roundName.startsWith(prefix)) await tx.fixture.update({ where: { id: fixture.id }, data: { roundName: (group.name + ' - ' + fixture.roundName.slice(prefix.length)).slice(0, 80) } });
        }
      }
      let sequence = Math.max(0, ...s.fixtures.map(f => f.sequence));
      for (const blueprint of plan.creates) {
        const publishedAt = s.tournament.fixturesPublishedAt || (s.fixtures.some(f => f.groupId === blueprint.groupId && f.publishedAt) ? new Date() : null);
        const fixture = await tx.fixture.create({ data: { ...blueprint, tournamentId, fixtureCode: 'FCA-F-' + randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase(), sequence: ++sequence, phase: 'STAGE', publishedAt } });
        const match = await tx.match.create({ data: { tournamentId, fixtureId: fixture.id } });
        await tx.match.update({ where: { id: match.id }, data: { matchCode: 'FCA-M-' + String(match.serialNumber).padStart(6, '0') } });
      }
      if (removedGroups.length) await tx.tournamentGroup.deleteMany({ where: { tournamentId, id: { in: removedGroups.map(g => g.id) } } });
      for (const group of desired.filter(g => !newGroups.some(n => n.id === g.id))) {
        const old = s.groups.find(g => g.id === group.id)!;
        if (old.name !== group.name || old.position !== group.position) await tx.tournamentGroup.update({ where: { id: group.id }, data: { name: group.name, position: group.position } });
      }
      if (preview.membershipChanged && s.tournament.playoffSource === 'GROUP_QUALIFIERS' && s.tournament.qualifiersPerGroup && !usesBestThirdPlayoffs(s.tournament)) {
        await tx.tournament.update({ where: { id: tournamentId }, data: { playoffQualifiersTotal: desired.length * s.tournament.qualifiersPerGroup } });
      }
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'TOURNAMENT_GROUPS_REORGANIZED',
        targetType: 'Tournament', targetId: tournamentId, scopeType: 'TOURNAMENT', scopeId: tournamentId,
        beforeData: { revision: s.revision }, afterData: { planHash: preview.planHash, ...preview.impact } } });
      return preview.impact;
    }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 60000 });
    const state = await this.getEditor(userId, tournamentId);
    return { success: true, data: { message: 'Groups saved. Existing results and retained fixture dates are preserved. Schedule any newly added fixtures.', editor: state.data.editor, impact: result }, error: null };
  }
}

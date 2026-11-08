import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { AuthorizationService } from '../src/security/authorization.service.js';
import { TournamentsService } from '../src/tournaments/tournaments.service.js';
import { TournamentEntriesService } from '../src/tournaments/tournament-entries.service.js';

describe('Chosen teams use real serializable database transactions', () => {
  const run = randomUUID().slice(0, 8), users = Array.from({ length: 7 }, () => randomUUID());
  let db: PrismaService, players: TournamentsService, entries: TournamentEntriesService, leagueId: string;
  let cups: string[], winner: { id: string; registeredByUserId: string };
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.NODE_ENV !== 'test' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw Error('Disposable loopback *_test database required');
    db = new PrismaService(); await db.$connect();
    const authorization = new AuthorizationService(db);
    players = new TournamentsService(db, authorization); entries = new TournamentEntriesService(db, authorization);
    for (const [i, id] of users.entries()) await db.user.create({ data: { id, email: `chosen-${run}-${i}@example.invalid`, fullName: `Chosen ${i}`, passwordHash: 'not-a-login-hash', status: 'ACTIVE', player: { create: { playerCode: `CH-${run}-${i}`, identity: { create: { inGameName: `Chosen ${i}`, inGameNameNormalized: `chosen ${run} ${i}`, isVerified: true } } } } } });
    const league = await db.league.create({ data: { name: 'Chosen names test', code: `CH${run}`, creatorUserId: users[0] } }); leagueId = league.id;
    await db.leagueMember.createMany({ data: users.slice(0, 6).map(userId => ({ userId, leagueId, type: 'PRIMARY' })) });
    await db.leagueAdmin.create({ data: { leagueId, userId: users[0], role: 'OWNER' } });
    cups = [];
    for (let i = 0; i < 2; i++) cups.push((await db.tournament.create({ data: { name: 'International test', code: `CH-T-${run}${i}`, leagueId, createdByUserId: users[0], mode: 'SOLO', format: 'ROUND_ROBIN', teamSize: 1, maxEntries: 48, status: 'REGISTRATION_OPEN', registrationMode: 'APPROVAL' } })).id);
  }, 60000);
  afterAll(async () => { await db?.$disconnect(); });

  it('commits exactly one of two simultaneous choices of the same national team', async () => {
    const attempts = await Promise.allSettled([1, 2].map(i => players.register(users[i], cups[0], { inGameName: `Chosen ${i}`, entryName: i === 1 ? 'Belgium' : '  ＢＥＬＧＩＵＭ  ' })));
    expect(attempts.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.find(x => x.status === 'rejected')).toMatchObject({ reason: { response: { error: { code: 'ENTRY_NAME_ALREADY_EXISTS' } } } });
    const rows = await db.tournamentRegistration.findMany({ where: { tournamentId: cups[0] } }); expect(rows).toHaveLength(1); winner = rows[0];
    expect(await db.tournamentRegistrationMember.count({ where: { tournamentId: cups[0] } })).toBe(1);
  });
  it('exposes pending choices to league members and denies unrelated accounts', async () => {
    const list = await entries.listEntries(users[3], cups[0]);
    expect(list.data.entries).toHaveLength(1); expect(list.data.entries[0].status).toBe('PENDING');
    await expect(entries.listEntries(users[6], cups[0])).rejects.toMatchObject({ status: 403 });
  });
  it('keeps names scoped to the tournament, including simultaneous tournaments in the same league', async () => {
    await expect(players.register(users[3], cups[1], { inGameName: 'Chosen 3', entryName: 'Belgium' })).resolves.toMatchObject({ success: true });
  });
  it('uses the same guard for manual add, bulk add and editing while preserving an unchanged own name', async () => {
    await expect(entries.createEntry(users[0], cups[0], { entryName: 'belgium' })).rejects.toMatchObject({ response: { error: { code: 'ENTRY_NAME_ALREADY_EXISTS' } } });
    await expect(entries.bulkCreateEntries(users[0], cups[0], { names: ['Liverpool', 'BELGIUM'] })).rejects.toMatchObject({ response: { error: { code: 'ENTRY_NAME_ALREADY_EXISTS' } } });
    await expect(entries.updateEntry(winner.registeredByUserId, cups[0], winner.id, { entryName: 'Belgium' })).resolves.toMatchObject({ success: true });
    const added = await entries.createEntry(users[0], cups[0], { entryName: 'Liverpool' });
    await expect(entries.updateEntry(users[0], cups[0], added.data.entry.id, { entryName: 'BELGIUM' })).rejects.toMatchObject({ response: { error: { code: 'ENTRY_NAME_ALREADY_EXISTS' } } });
    expect(await db.tournamentRegistration.count({ where: { tournamentId: cups[0] } })).toBe(2);
  });
  it('releases rejected choices and reserves the replacement as pending immediately', async () => {
    await db.tournamentRegistration.update({ where: { id: winner.id }, data: { status: 'REJECTED' } });
    await expect(players.register(users[4], cups[0], { inGameName: 'Chosen 4', entryName: 'Belgium' })).resolves.toMatchObject({ success: true });
    const active = await db.tournamentRegistration.findMany({ where: { tournamentId: cups[0], status: { in: ['PENDING', 'APPROVED'] } } });
    expect(active.filter(row => row.entryName?.trim().toLowerCase() === 'belgium')).toHaveLength(1);
  });
});

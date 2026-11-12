import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { expect, it, vi } from 'vitest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { configureHttpSecurity } from '../security/http-security.js';
import { TournamentEntriesController } from './tournament-entries.controller.js';
import { TournamentEntriesService } from './tournament-entries.service.js';
import { TournamentEntryLogoService } from './tournament-entry-logo.service.js';
import { TournamentPlayerReplacementService } from './tournament-player-replacement.service.js';

it.each([
  ['replacement-preview', 'preview'],
  ['replace-player', 'replace'],
])('%s serves JSON even when a player name contains HTML characters', async (endpoint, method) => {
  const userId = randomUUID();
  const playerName = '<img src=x onerror=alert(1)>';
  const replacement = vi.fn().mockResolvedValue({
    success: true,
    data: { replacement: { name: playerName }, message: 'Player replaced.' },
    error: null,
  });
  const module = await Test.createTestingModule({
    controllers: [TournamentEntriesController],
    providers: [
      { provide: TournamentEntriesService, useValue: {} },
      { provide: TournamentEntryLogoService, useValue: {} },
      { provide: TournamentPlayerReplacementService, useValue: { [method]: replacement } },
    ],
  }).overrideGuard(JwtAuthGuard).useValue({
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().user = { sub: userId };
      return true;
    },
  }).compile();
  const app = module.createNestApplication();
  try {
    configureHttpSecurity(app);
    await app.listen(0, '127.0.0.1');
    const response = await request(app.getHttpServer())
      .post(`/api/tournaments/${randomUUID()}/entries/${randomUUID()}/${endpoint}`)
      .set('Accept', 'text/html')
      .send({ outgoingUserId: randomUUID(), replacementPlayerCode: 'FCA-01' })
      .expect(201)
      .expect('Content-Type', /application\/json/i)
      .expect('X-Content-Type-Options', 'nosniff');
    expect(response.body.data.replacement.name).toBe(playerName);
  } finally {
    await app.close();
  }
});

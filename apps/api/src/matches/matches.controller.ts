import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import type {
  Request,
  Response,
} from 'express';

import type {
  AccessTokenPayload,
} from '../auth/auth.types.js';

import {
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

import {
  SetMatchReadyDto,
} from './dto/set-match-ready.dto.js';
import { ProposeMatchTimeDto } from './dto/propose-match-time.dto.js';

import {
  MatchRealtimeService,
} from './match-realtime.service.js';

import {
  MatchesService,
} from './matches.service.js';

type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };

@Controller('matches')
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(
    private readonly matchesService:
      MatchesService,

    private readonly realtime:
      MatchRealtimeService,
    private readonly authGuard: JwtAuthGuard,
  ) {}

  @Get(':matchId/events')
  async streamMatchEvents(
    @Req()
    request:
      AuthenticatedRequest,

    @Res()
    response:
      Response,

    @Param('matchId')
    matchId: string,
  ) {
    await this.matchesService.assertRealtimeAccess(
      request.user.sub,
      matchId,
    );

    response.status(
      200,
    );

    response.setHeader(
      'Content-Type',
      'text/event-stream',
    );

    response.setHeader(
      'Cache-Control',
      'no-cache, no-transform',
    );

    response.setHeader(
      'Connection',
      'keep-alive',
    );

    response.setHeader(
      'X-Accel-Buffering',
      'no',
    );

    response.flushHeaders?.();

    let closed = false, pending = 0;
    let queue = Promise.resolve();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let unsubscribe = () => {};
    function cleanup() {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
      if (!response.writableEnded) response.end();
    }
    const send = (event: unknown) => {
      if (closed || response.writableEnded) return;
      if (response.writableLength > 65_536) { cleanup(); return; }
      response.write(`event: match\ndata: ${JSON.stringify(event)}\n\n`);
    };
    const enqueue = (write: () => void) => {
      if (closed) return;
      if (pending >= 32) { cleanup(); return; }
      pending++;
      queue = queue.then(async () => {
        if (closed) return;
        await this.authGuard.authenticateRequest(request);
        await this.matchesService.assertRealtimeAccess(request.user.sub, matchId);
        if (!closed) write();
      }).catch(() => cleanup()).finally(() => { pending--; });
    };
    send({ type: 'connected', matchId, at: new Date().toISOString() });
    unsubscribe = this.realtime.subscribe(matchId, event => enqueue(() => send(event)));
    heartbeat = setInterval(() => enqueue(() => {
      if (response.writableLength > 65_536) cleanup();
      else if (!closed && !response.writableEnded) response.write(': heartbeat\n\n');
    }), 20_000);
    heartbeat.unref?.();
    response.on('close', cleanup);
    request.on('aborted', cleanup);
    if (response.destroyed || request.aborted) cleanup();

  }

  @Get(':matchId/scheduling')
  listTimeProposals(
    @Req() request: AuthenticatedRequest,
    @Param('matchId') matchId: string,
  ) {
    return this.matchesService.getTimeProposals(request.user.sub, matchId);
  }

  @Post(':matchId/scheduling')
  proposeTime(
    @Req() request: AuthenticatedRequest,
    @Param('matchId') matchId: string,
    @Body() dto: ProposeMatchTimeDto,
  ) {
    return this.matchesService.proposeMatchTime(request.user.sub, matchId, dto);
  }

  @Post(':matchId/scheduling/:proposalId/accept')
  acceptTime(
    @Req() request: AuthenticatedRequest,
    @Param('matchId') matchId: string,
    @Param('proposalId') proposalId: string,
  ) {
    return this.matchesService.acceptMatchTime(request.user.sub, matchId, proposalId);
  }

  @Post(':matchId/scheduling/:proposalId/cancel')
  cancelTime(
    @Req() request: AuthenticatedRequest,
    @Param('matchId') matchId: string,
    @Param('proposalId') proposalId: string,
  ) {
    return this.matchesService.cancelMatchTime(request.user.sub, matchId, proposalId);
  }

  @Post(':matchId/ready')
  setReady(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('matchId')
    matchId: string,

    @Body()
    dto:
      SetMatchReadyDto,
  ) {
    return this.matchesService.setReady(
      request.user.sub,
      matchId,
      dto,
    );
  }

  @Get(':matchId')
  getMatch(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('matchId')
    matchId: string,
  ) {
    return this.matchesService.getMatch(
      request.user.sub,
      matchId,
    );
  }
}

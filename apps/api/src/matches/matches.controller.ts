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

    const send =
      (
        event:
          unknown,
      ) => {
        if (
          response.writableEnded
        ) {
          return;
        }

        response.write(
          `event: match\ndata: ${JSON.stringify(
            event,
          )}\n\n`,
        );
      };

    send({
      type:
        'connected',
      matchId,
      at:
        new Date()
          .toISOString(),
    });

    const unsubscribe =
      this.realtime.subscribe(
        matchId,
        send,
      );

    const heartbeat =
      setInterval(
        () => {
          if (
            !response.writableEnded
          ) {
            response.write(
              ': heartbeat\n\n',
            );
          }
        },
        20_000,
      );

    heartbeat.unref?.();

    const cleanup =
      () => {
        clearInterval(
          heartbeat,
        );

        unsubscribe();

        if (
          !response.writableEnded
        ) {
          response.end();
        }
      };

    request.on(
      'close',
      cleanup,
    );

    request.on(
      'aborted',
      cleanup,
    );
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

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type {
  Request,
} from 'express';

import type {
  AccessTokenPayload,
} from '../auth/auth.types.js';

import {
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard.js';

import {
  CreateDisputeDto,
} from './dto/create-dispute.dto.js';

import {
  ResolveDisputeDto,
} from './dto/resolve-dispute.dto.js';

import {
  DisputesService,
} from './disputes.service.js';

type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };

@Controller()
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(
    private readonly disputesService:
      DisputesService,
  ) {}

  @Get(
    'matches/:matchId/disputes',
  )
  getMatchDisputes(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('matchId')
    matchId: string,
  ) {
    return this.disputesService.getMatchDisputes(
      request.user.sub,
      matchId,
    );
  }

  @Post(
    'matches/:matchId/disputes',
  )
  createDispute(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('matchId')
    matchId: string,

    @Body()
    dto:
      CreateDisputeDto,
  ) {
    return this.disputesService.createDispute(
      request.user.sub,
      matchId,
      dto,
    );
  }

  @Get(
    'admin/disputes',
  )
  getAdminDisputes(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.disputesService.getAdminDisputes(
      request.user.sub,
    );
  }

  @Post(
    'admin/disputes/:disputeId/resolve',
  )
  resolveDispute(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('disputeId')
    disputeId: string,

    @Body()
    dto:
      ResolveDisputeDto,
  ) {
    return this.disputesService.resolveDispute(
      request.user.sub,
      disputeId,
      dto,
    );
  }
}

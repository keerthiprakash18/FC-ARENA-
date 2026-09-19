import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
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
  CreateTournamentGroupDto,
} from './dto/create-tournament-group.dto.js';

import {
  DistributeTournamentGroupsDto,
} from './dto/distribute-tournament-groups.dto.js';

import {
  UpdateTournamentGroupDto,
} from './dto/update-tournament-group.dto.js';

import {
  TournamentGroupsService,
} from './tournament-groups.service.js';


type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };


@Controller()
@UseGuards(
  JwtAuthGuard,
)
export class TournamentGroupsAdminController {
  constructor(
    private readonly tournamentGroupsService:
      TournamentGroupsService,
  ) {}


  @Post(
    'tournaments/:tournamentId/groups',
  )
  createGroup(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'tournamentId',
    )
    tournamentId:
      string,

    @Body()
    dto:
      CreateTournamentGroupDto,
  ) {
    return this.tournamentGroupsService.createGroup(
      request.user.sub,
      tournamentId,
      dto,
    );
  }


  @Patch(
    'tournaments/:tournamentId/groups/:groupId',
  )
  renameGroup(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'tournamentId',
    )
    tournamentId:
      string,

    @Param(
      'groupId',
    )
    groupId:
      string,

    @Body()
    dto:
      UpdateTournamentGroupDto,
  ) {
    return this.tournamentGroupsService.renameGroup(
      request.user.sub,
      tournamentId,
      groupId,
      dto,
    );
  }


  @Delete(
    'tournaments/:tournamentId/groups/:groupId',
  )
  deleteGroup(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'tournamentId',
    )
    tournamentId:
      string,

    @Param(
      'groupId',
    )
    groupId:
      string,
  ) {
    return this.tournamentGroupsService.deleteGroup(
      request.user.sub,
      tournamentId,
      groupId,
    );
  }


  @Post(
    'tournaments/:tournamentId/groups/distribute',
  )
  distributeGroups(
    @Req()
    request:
      AuthenticatedRequest,

    @Param(
      'tournamentId',
    )
    tournamentId:
      string,

    @Body()
    dto:
      DistributeTournamentGroupsDto,
  ) {
    return this.tournamentGroupsService.distributeGroups(
      request.user.sub,
      tournamentId,
      dto,
    );
  }
}
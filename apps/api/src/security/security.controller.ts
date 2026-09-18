import {
  Body,
  Controller,
  Delete,
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
  AssignRoleDto,
} from './dto/assign-role.dto.js';

import {
  RoleManagementService,
} from './role-management.service.js';

type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
  constructor(
    private readonly roleManagement:
      RoleManagementService,
  ) {}

  @Get('me/access')
  myAccess(
    @Req()
    request:
      AuthenticatedRequest,
  ): Promise<unknown> {
    return this.roleManagement.getMyAccess(
      request.user.sub,
    );
  }

  @Post('roles')
  assignRole(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      AssignRoleDto,
  ): Promise<unknown> {
    return this.roleManagement.assignRole(
      request.user.sub,
      dto,
    );
  }

  @Delete(
    'roles/:assignmentId',
  )
  removeRole(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('assignmentId')
    assignmentId: string,
  ): Promise<unknown> {
    return this.roleManagement.removeRole(
      request.user.sub,
      assignmentId,
    );
  }

  @Get(
    'roles/:scopeType/:scopeId',
  )
  listScopeRoles(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('scopeType')
    rawScopeType: string,

    @Param('scopeId')
    scopeId: string,
  ): Promise<unknown> {
    const scopeType =
      rawScopeType.toUpperCase();

    if (
      scopeType !==
        'GLOBAL' &&
      scopeType !==
        'LEAGUE' &&
      scopeType !==
        'TOURNAMENT'
    ) {
      return Promise.reject(
        new Error(
          'Invalid scope type.',
        ),
      );
    }

    return this.roleManagement.listScopeRoles(
      request.user.sub,
      scopeType,
      scopeId,
    );
  }

  @Get(
    'audit/:scopeType/:scopeId',
  )
  auditForScope(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('scopeType')
    rawScopeType: string,

    @Param('scopeId')
    scopeId: string,
  ): Promise<unknown> {
    const scopeType =
      rawScopeType.toUpperCase();

    if (
      scopeType !==
        'GLOBAL' &&
      scopeType !==
        'LEAGUE' &&
      scopeType !==
        'TOURNAMENT'
    ) {
      return Promise.reject(
        new Error(
          'Invalid scope type.',
        ),
      );
    }

    return this.roleManagement.getAuditForScope(
      request.user.sub,
      scopeType,
      scopeId,
    );
  }
}
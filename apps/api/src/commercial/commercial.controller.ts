import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
  CommercialService,
} from './commercial.service.js';

import {
  CreateSponsorDto,
} from './dto/create-sponsor.dto.js';

import {
  UpdateSponsorDto,
} from './dto/update-sponsor.dto.js';

import {
  CreateSponsorPlacementDto,
} from './dto/create-sponsor-placement.dto.js';

import {
  UpdateSponsorPlacementDto,
} from './dto/update-sponsor-placement.dto.js';

import {
  CreateSubscriptionPlanDto,
} from './dto/create-subscription-plan.dto.js';

import {
  UpdateSubscriptionPlanDto,
} from './dto/update-subscription-plan.dto.js';

import {
  GrantSubscriptionDto,
} from './dto/grant-subscription.dto.js';

type AuthenticatedRequest =
  Request & {
    user:
      AccessTokenPayload;
  };

@Controller('commercial')
@UseGuards(JwtAuthGuard)
export class CommercialController {
  constructor(
    private readonly commercial:
      CommercialService,
  ) {}

  @Get()
  overview(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.commercial.getOverview(
      request.user.sub,
    );
  }

  @Get('plans')
  plans(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.commercial.getPlans(
      request.user.sub,
    );
  }

  @Get('me')
  membership(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.commercial.getMyMembership(
      request.user.sub,
    );
  }

  @Get('placements')
  placements(
    @Req()
    request:
      AuthenticatedRequest,

    @Query('key')
    key?: string,
  ) {
    return this.commercial.getPlacements(
      request.user.sub,
      key,
    );
  }
}

@Controller('admin/commercial')
@UseGuards(JwtAuthGuard)
export class CommercialAdminController {
  constructor(
    private readonly commercial:
      CommercialService,
  ) {}

  @Get()
  overview(
    @Req()
    request:
      AuthenticatedRequest,
  ) {
    return this.commercial.adminOverview(
      request.user.sub,
    );
  }

  @Post('sponsors')
  createSponsor(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      CreateSponsorDto,
  ) {
    return this.commercial.createSponsor(
      request.user.sub,
      dto,
    );
  }

  @Patch('sponsors/:sponsorId')
  updateSponsor(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('sponsorId')
    sponsorId: string,

    @Body()
    dto:
      UpdateSponsorDto,
  ) {
    return this.commercial.updateSponsor(
      request.user.sub,
      sponsorId,
      dto,
    );
  }

  @Post('placements')
  createPlacement(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      CreateSponsorPlacementDto,
  ) {
    return this.commercial.createPlacement(
      request.user.sub,
      dto,
    );
  }

  @Patch('placements/:placementId')
  updatePlacement(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('placementId')
    placementId: string,

    @Body()
    dto:
      UpdateSponsorPlacementDto,
  ) {
    return this.commercial.updatePlacement(
      request.user.sub,
      placementId,
      dto,
    );
  }

  @Post('plans')
  createPlan(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      CreateSubscriptionPlanDto,
  ) {
    return this.commercial.createPlan(
      request.user.sub,
      dto,
    );
  }

  @Patch('plans/:planId')
  updatePlan(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('planId')
    planId: string,

    @Body()
    dto:
      UpdateSubscriptionPlanDto,
  ) {
    return this.commercial.updatePlan(
      request.user.sub,
      planId,
      dto,
    );
  }

  @Post('subscriptions/grant')
  grant(
    @Req()
    request:
      AuthenticatedRequest,

    @Body()
    dto:
      GrantSubscriptionDto,
  ) {
    return this.commercial.grantSubscription(
      request.user.sub,
      dto,
    );
  }

  @Post('subscriptions/:subscriptionId/cancel')
  cancel(
    @Req()
    request:
      AuthenticatedRequest,

    @Param('subscriptionId')
    subscriptionId:
      string,
  ) {
    return this.commercial.cancelSubscription(
      request.user.sub,
      subscriptionId,
    );
  }
}

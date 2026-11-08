import { Body, Controller, Get, Patch, Post, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import { Equals, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CommunityExceptionFilter } from '../arena/community-exception.filter.js';
import { DailyRewardsService } from './daily-rewards.service.js';
import { REWARD_COSMETICS } from './daily-reward-policy.js';
class MonthQuery { @IsOptional() @IsString() @Matches(/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/) month?:string; }
class ClaimDto { @Equals('DAILY_CHECK_IN') intent!:string; }
class PurchaseDto { @IsIn(REWARD_COSMETICS.map(item=>item.id)) itemId!:string; }
class EquipDto { @IsIn(['CLASSIC','NONE_BADGE',...REWARD_COSMETICS.map(item=>item.id)]) itemId!:string; }
type AuthRequest = Request & {user:AccessTokenPayload};
@Controller('experience/me')
@UseGuards(JwtAuthGuard)
@UseFilters(CommunityExceptionFilter)
export class DailyRewardsController {
  constructor(private readonly rewards:DailyRewardsService){}
  @Get('check-in') get(@Req() request:AuthRequest,@Query() query:MonthQuery){return this.rewards.getMine(request.user.sub,query.month);}
  @Post('check-in') claim(@Req() request:AuthRequest,@Body() _body:ClaimDto,@Query() query:MonthQuery){return this.rewards.claim(request.user.sub,query.month);}
  @Post('cosmetics/purchase') purchase(@Req() request:AuthRequest,@Body() body:PurchaseDto,@Query() query:MonthQuery){return this.rewards.purchase(request.user.sub,body.itemId,query.month);}
  @Patch('cosmetics/equip') equip(@Req() request:AuthRequest,@Body() body:EquipDto,@Query() query:MonthQuery){return this.rewards.equip(request.user.sub,body.itemId,query.month);}
}

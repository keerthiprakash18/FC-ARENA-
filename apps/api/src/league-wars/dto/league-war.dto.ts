import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateLeagueWarDto {
  @IsUUID('4')
  homeLeagueId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(20)
  opponentLeagueCode!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  name?: string;

  @IsInt()
  @Min(1)
  @Max(30)
  playerCount!: number;

  @IsIn([
    'SINGLE_LEG',
    'HOME_AWAY',
  ])
  legType!:
    | 'SINGLE_LEG'
    | 'HOME_AWAY';

  @IsOptional()
  @IsIn([
    'SLOT',
    'MANUAL',
    'RANDOM',
  ])
  pairingMode?:
    | 'SLOT'
    | 'MANUAL'
    | 'RANDOM';

  @IsOptional()
  @IsInt()
  @Min(-10)
  @Max(20)
  winPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(-10)
  @Max(20)
  drawPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(-10)
  @Max(20)
  lossPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  challengeExpiryHours?: number;

  @IsOptional()
  @IsISO8601()
  scheduledStartAt?: string;

  @IsOptional()
  @IsISO8601()
  deadlineAt?: string;
}

export class SetLeagueWarRosterDto {
  @IsUUID('4')
  leagueId!: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('4', {
    each: true,
  })
  userIds!: string[];
}

export class SetLeagueWarReadyDto {
  @IsUUID('4')
  leagueId!: string;

  @IsBoolean()
  ready!: boolean;
}

export class UpdateLeagueWarResultDto {
  @IsInt()
  @Min(0)
  @Max(99)
  homeScore!: number;

  @IsInt()
  @Min(0)
  @Max(99)
  awayScore!: number;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  proofUrl?: string;
}

export class LeagueWarReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class LeagueWarDisputeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class LeagueWarWalkoverDto {
  @IsUUID('4')
  winnerLeagueId!: string;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  proofUrl?: string;
}

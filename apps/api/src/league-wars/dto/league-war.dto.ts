import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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

export class UpdateLeagueWarResultDto {
  @IsInt()
  @Min(0)
  @Max(99)
  homeScore!: number;

  @IsInt()
  @Min(0)
  @Max(99)
  awayScore!: number;
}

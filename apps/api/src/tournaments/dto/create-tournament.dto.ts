import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsIn(['SOLO', 'DUO', 'TEAM'])
  mode!: 'SOLO' | 'DUO' | 'TEAM';

  // Legacy field kept so the current FC ARENA UI does not break.
  @IsOptional()
  @IsIn(['ROUND_ROBIN', 'KNOCKOUT'])
  format?: 'ROUND_ROBIN' | 'KNOCKOUT';

  @IsOptional()
  @IsIn([
    'LEAGUE_ROUND_ROBIN',
    'DOUBLE_ROUND_ROBIN',
    'SINGLE_ELIMINATION',
    'GROUP_STAGE_KNOCKOUT',
    'ELITE_CUP',
    'CUSTOM_MANUAL',
  ])
  competitionFormat?:
    | 'LEAGUE_ROUND_ROBIN'
    | 'DOUBLE_ROUND_ROBIN'
    | 'SINGLE_ELIMINATION'
    | 'GROUP_STAGE_KNOCKOUT'
    | 'ELITE_CUP'
    | 'CUSTOM_MANUAL';

  @IsOptional()
  @IsIn([
    'SINGLE_GROUP',
    'MULTIPLE_GROUPS',
  ])
  groupMode?:
    | 'SINGLE_GROUP'
    | 'MULTIPLE_GROUPS';

  @IsOptional()
  @IsIn([
    'SINGLE_LEG',
    'HOME_AWAY',
  ])
  legType?:
    | 'SINGLE_LEG'
    | 'HOME_AWAY';

  @IsOptional()
  @IsIn([
    'AUTOMATIC',
    'RANDOMIZED',
    'MANUAL',
  ])
  fixtureMode?:
    | 'AUTOMATIC'
    | 'RANDOMIZED'
    | 'MANUAL';

  @IsOptional()
  @IsIn([
    'PRIVATE',
    'LEAGUE',
    'PUBLIC',
  ])
  visibility?:
    | 'PRIVATE'
    | 'LEAGUE'
    | 'PUBLIC';

  @IsOptional()
  @IsIn([
    'OPEN',
    'APPROVAL',
    'ADMIN_ONLY',
  ])
  registrationMode?:
    | 'OPEN'
    | 'APPROVAL'
    | 'ADMIN_ONLY';

  @IsInt()
  @Min(2)
  @Max(128)
  maxEntries!: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(11)
  teamSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  rules?: string;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  logoUrl?: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  dailyMatchLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  matchesPerParticipantPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  matchDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  resultDeadlineHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(128)
  qualifiersPerGroup?: number;

  @IsOptional()
  @IsIn(['CROSS_GROUP', 'SEEDED', 'RANDOM', 'MANUAL'])
  playoffPairingMethod?: 'CROSS_GROUP' | 'SEEDED' | 'RANDOM' | 'MANUAL';
}

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

export class UpdateTournamentSetupDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

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
  @IsIn([
    'SOLO',
    'DUO',
    'TEAM',
  ])
  mode?: 'SOLO' | 'DUO' | 'TEAM';

  @IsOptional()
  @IsIn([
    'LEAGUE_ROUND_ROBIN',
    'DOUBLE_ROUND_ROBIN',
    'SINGLE_ELIMINATION',
    'GROUP_STAGE_KNOCKOUT',
    'CUSTOM_MANUAL',
  ])
  competitionFormat?:
    | 'LEAGUE_ROUND_ROBIN'
    | 'DOUBLE_ROUND_ROBIN'
    | 'SINGLE_ELIMINATION'
    | 'GROUP_STAGE_KNOCKOUT'
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

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(128)
  maxEntries?: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(11)
  teamSize?: number;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;
}
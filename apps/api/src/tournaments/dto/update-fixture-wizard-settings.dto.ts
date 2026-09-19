import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateFixtureWizardSettingsDto {
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
    'SINGLE_LEG',
    'HOME_AWAY',
  ])
  legType?:
    | 'SINGLE_LEG'
    | 'HOME_AWAY';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
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
}
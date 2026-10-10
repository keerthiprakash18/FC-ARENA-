import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateQualificationSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(64)
  qualifiersPerGroup?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(128)
  playoffQualifiersTotal?: number;

  @IsIn([
    'GLOBAL_SEEDED',
    'PROTECTED_SEED',
    'DOUBLE_CHANCE',
  ])
  playoffFormat!:
    | 'GLOBAL_SEEDED'
    | 'PROTECTED_SEED'
    | 'DOUBLE_CHANCE';

  @IsIn([
    'AUTO',
    'DIRECT_ENTRIES',
    'OVERALL_STANDINGS',
    'GROUP_QUALIFIERS',
  ])
  playoffSource!:
    | 'AUTO'
    | 'DIRECT_ENTRIES'
    | 'OVERALL_STANDINGS'
    | 'GROUP_QUALIFIERS';

  @IsIn([
    'AUTO',
    'OVERALL_PERFORMANCE',
    'GROUP_POSITION',
    'MANUAL',
    'RANDOM',
  ])
  playoffSeedingBasis!:
    | 'AUTO'
    | 'OVERALL_PERFORMANCE'
    | 'GROUP_POSITION'
    | 'MANUAL'
    | 'RANDOM';

  @IsOptional()
  @IsBoolean()
  avoidSameGroupEarly?: boolean;

  @IsOptional()
  @IsIn([
    'CROSS_GROUP',
    'SEEDED',
    'RANDOM',
    'MANUAL',
  ])
  playoffPairingMethod?:
    | 'CROSS_GROUP'
    | 'SEEDED'
    | 'RANDOM'
    | 'MANUAL';
}

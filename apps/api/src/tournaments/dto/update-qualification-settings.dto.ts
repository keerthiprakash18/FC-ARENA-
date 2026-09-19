import {
  IsIn,
  IsInt,
  Max,
  Min,
} from 'class-validator';

export class UpdateQualificationSettingsDto {
  @IsInt()
  @Min(1)
  @Max(64)
  qualifiersPerGroup!: number;

  @IsIn([
    'CROSS_GROUP',
    'SEEDED',
    'RANDOM',
    'MANUAL',
  ])
  playoffPairingMethod!:
    | 'CROSS_GROUP'
    | 'SEEDED'
    | 'RANDOM'
    | 'MANUAL';
}
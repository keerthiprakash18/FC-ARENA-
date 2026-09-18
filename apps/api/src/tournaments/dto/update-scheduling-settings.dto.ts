import {
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateSchedulingSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(256)
  dailyMatchLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  matchesPerParticipantPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(300)
  matchDurationMinutes?: number;
}
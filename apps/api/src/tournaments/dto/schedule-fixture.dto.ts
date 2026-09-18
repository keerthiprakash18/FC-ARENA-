import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ScheduleFixtureDto {
  @IsISO8601()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  venue?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  matchday?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  roundNumber?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  roundName?: string;
}
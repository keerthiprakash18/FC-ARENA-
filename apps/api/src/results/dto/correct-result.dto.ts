import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CorrectResultDto {
  @IsInt()
  @Min(0)
  @Max(99)
  homeScore!: number;

  @IsInt()
  @Min(0)
  @Max(99)
  awayScore!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  homePenaltyScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  awayPenaltyScore?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

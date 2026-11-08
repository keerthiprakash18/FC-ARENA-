import {
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class SubmitResultDto {
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
}

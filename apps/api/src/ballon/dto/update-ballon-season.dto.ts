import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateBallonSeasonDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  minimumMatches?: number;

  @IsOptional()
  @IsIn([10, 20, 50])
  rankingLimit?: 10 | 20 | 50;

  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
  })
  eligibleLeagueIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
  })
  eligibleTournamentIds?: string[];

  @IsOptional()
  @IsObject()
  scoringConfig?: Record<
    string,
    number
  >;
}

import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBallonSeasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  minMatches?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(100)
  rankingSize?: number;

  @IsOptional()
  @IsBoolean()
  soloOnly?: boolean;

  @IsOptional()
  @IsUUID()
  leagueId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  tournamentIds?: string[];
}

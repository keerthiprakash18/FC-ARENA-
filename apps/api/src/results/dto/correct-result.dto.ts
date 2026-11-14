import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DuoGameDto } from './duo-game.dto.js';
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

  /** Required for new aggregate-scored Duo tournaments; rejected for all other modes. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => DuoGameDto)
  duoGames?: DuoGameDto[];

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

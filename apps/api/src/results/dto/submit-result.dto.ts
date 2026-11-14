import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DuoGameDto } from './duo-game.dto.js';
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

  /** Required for new aggregate-scored Duo tournaments; rejected for all other modes. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
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
}

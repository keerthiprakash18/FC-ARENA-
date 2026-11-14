import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested,
} from 'class-validator';

/** One individual game between the specified players on the fixture's sides. */
export class DuoGameDto {
  @IsUUID('4')
  homePlayerId!: string;

  @IsUUID('4')
  awayPlayerId!: string;

  @IsInt()
  @Min(0)
  @Max(99)
  homeGoals!: number;

  @IsInt()
  @Min(0)
  @Max(99)
  awayGoals!: number;
}

export class DuoAggregateDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => DuoGameDto)
  duoGames!: DuoGameDto[];
}

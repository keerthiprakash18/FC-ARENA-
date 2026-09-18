import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RegisterTournamentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  entryName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(11)
  @IsString({ each: true })
  playerCodes!: string[];
}
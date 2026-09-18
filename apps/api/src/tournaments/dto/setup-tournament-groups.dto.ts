import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SetupTournamentGroupsDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(16)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(40, { each: true })
  groupNames!: string[];
}

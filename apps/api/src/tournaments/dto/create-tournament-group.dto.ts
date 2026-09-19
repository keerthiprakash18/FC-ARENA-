import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTournamentGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;
}
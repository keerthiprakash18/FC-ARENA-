import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ResetTournamentFixturesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  confirmation!: string;
}

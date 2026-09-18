import { IsString, MaxLength, MinLength } from 'class-validator';

export class JoinLeagueDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  code!: string;
}
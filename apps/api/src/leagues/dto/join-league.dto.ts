import { IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class JoinLeagueDto {
  @ValidateIf(dto => dto.code !== undefined || !dto.invite)
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  code?: string;

  @ValidateIf(dto => dto.invite !== undefined)
  @IsString()
  @Matches(/^[a-f0-9]{48}$/)
  invite?: string;
}

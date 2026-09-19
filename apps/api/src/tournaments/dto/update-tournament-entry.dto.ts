import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTournamentEntryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  entryName?: string;

  @IsOptional()
  @IsUrl({
    require_protocol: true,
  })
  entryLogoUrl?: string;
}
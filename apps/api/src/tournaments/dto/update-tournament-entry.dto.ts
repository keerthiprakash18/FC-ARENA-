import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const CREST_SOURCE =
  /^(https?:\/\/[^\s]+|data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/;

export class UpdateTournamentEntryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  entryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(750000)
  @Matches(
    CREST_SOURCE,
    {
      message:
        'entryLogoUrl must be an http(s) image URL or PNG/JPEG/WEBP image data.',
    },
  )
  entryLogoUrl?: string;
}

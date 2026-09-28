import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const SAFETY_REASONS = [
  'HARASSMENT_OR_BULLYING',
  'HATE_OR_ABUSE',
  'SEXUAL_CONTENT_OR_NUDITY',
  'GRAPHIC_VIOLENCE',
  'SPAM_OR_SCAM',
  'IMPERSONATION',
  'INAPPROPRIATE_PROFILE',
  'OTHER',
] as const;

const SAFETY_CONTENT_TYPES = [
  'USER_PROFILE',
  'PROFILE_PHOTO',
  'LEAGUE',
  'TOURNAMENT',
  'TEAM',
  'OTHER',
] as const;

export class ReportUserContentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  targetInGameName!: string;

  @IsString()
  @IsIn(
    SAFETY_REASONS,
  )
  reason!:
    typeof SAFETY_REASONS[number];

  @IsString()
  @IsIn(
    SAFETY_CONTENT_TYPES,
  )
  contentType!:
    typeof SAFETY_CONTENT_TYPES[number];

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  details?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contentReference?: string;
}

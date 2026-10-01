import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateSponsorPlacementDto {
  @IsOptional()
  @IsIn([
    'DASHBOARD',
    'AWARDS',
    'LEAGUE_WAR',
    'DISCOVER',
  ])
  key?:
    | 'DASHBOARD'
    | 'AWARDS'
    | 'LEAGUE_WAR'
    | 'DISCOVER';

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ctaLabel?: string;

  @IsOptional()
  @IsUrl({
    protocols: [
      'https',
    ],
    require_protocol:
      true,
  })
  @MaxLength(1500)
  ctaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  rewardText?: string;

  @IsOptional()
  @IsUrl({
    protocols: [
      'https',
    ],
    require_protocol:
      true,
  })
  @MaxLength(1500)
  termsUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(-100)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

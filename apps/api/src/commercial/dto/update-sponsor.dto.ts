import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateSponsorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsUrl({
    protocols: [
      'https',
    ],
    require_protocol:
      true,
  })
  @MaxLength(1500)
  logoUrl?: string;

  @IsOptional()
  @IsUrl({
    protocols: [
      'https',
    ],
    require_protocol:
      true,
  })
  @MaxLength(1500)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  disclosureLabel?: string;

  @IsOptional()
  @IsIn([
    'DRAFT',
    'ACTIVE',
    'PAUSED',
    'ARCHIVED',
  ])
  status?:
    | 'DRAFT'
    | 'ACTIVE'
    | 'PAUSED'
    | 'ARCHIVED';
}

import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDisputeDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @IsUrl(
    {
      protocols: [
        'https',
      ],
      require_protocol:
        true,
      require_tld:
        false,
    },
    {
      message:
        'Evidence URL must be a valid HTTPS URL.',
    },
  )
  @MaxLength(2000)
  evidenceUrl?: string;
}

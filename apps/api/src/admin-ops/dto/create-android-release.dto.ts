import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAndroidReleaseDto {
  @IsInt()
  @Min(1)
  versionCode!: number;

  @IsString()
  @MaxLength(40)
  @Matches(
    /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/,
  )
  versionName!: string;

  @IsIn([
    'INTERNAL',
    'CLOSED',
    'PRODUCTION',
  ])
  channel!:
    | 'INTERNAL'
    | 'CLOSED'
    | 'PRODUCTION';

  @IsOptional()
  @IsInt()
  @Min(1)
  minimumSupportedVersionCode?:
    number;

  @IsOptional()
  @IsInt()
  @Min(1)
  forceUpdateBelowVersionCode?:
    number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  releaseNotes?:
    string;

  @IsOptional()
  @IsUrl({
    protocols: [
      'https',
    ],
    require_protocol:
      true,
  })
  @MaxLength(1000)
  playStoreUrl?:
    string;

  @IsOptional()
  @IsString()
  @Matches(
    /^[0-9a-f]{40}$/i,
  )
  sourceCommit?:
    string;

  @IsOptional()
  @IsString()
  @Matches(
    /^[0-9a-f]{64}$/i,
  )
  artifactSha256?:
    string;
}

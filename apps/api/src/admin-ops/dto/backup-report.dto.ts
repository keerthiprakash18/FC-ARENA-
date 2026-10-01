import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class BackupReportDto {
  @IsIn([
    'SUCCESS',
    'FAILED',
  ])
  status!:
    | 'SUCCESS'
    | 'FAILED';

  @IsDateString()
  startedAt!: string;

  @IsDateString()
  completedAt!: string;

  @IsOptional()
  @IsString()
  @Matches(
    /^\d+$/,
  )
  @MaxLength(32)
  sizeBytes?:
    string;

  @IsOptional()
  @IsString()
  @Matches(
    /^[0-9a-f]{64}$/i,
  )
  checksumSha256?:
    string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  storageKind?:
    string;

  @IsOptional()
  @IsInt()
  @Min(1)
  retentionDays?:
    number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceHost?:
    string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  errorMessage?:
    string;
}

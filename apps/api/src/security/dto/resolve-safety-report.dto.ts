import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const SAFETY_DECISIONS = [
  'RESOLVED',
  'DISMISSED',
] as const;

export class ResolveSafetyReportDto {
  @IsOptional()
  @IsString()
  @IsIn(
    SAFETY_DECISIONS,
  )
  decision?:
    typeof SAFETY_DECISIONS[number];

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  note?: string;
}

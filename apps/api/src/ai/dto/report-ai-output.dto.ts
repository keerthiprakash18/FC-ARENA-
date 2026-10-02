import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReportAiOutputDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  response!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

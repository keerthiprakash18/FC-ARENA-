import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReviewDeadlineCaseDto {
  @IsIn(['RESOLVED', 'WAIVED'])
  status!: 'RESOLVED' | 'WAIVED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string;
}

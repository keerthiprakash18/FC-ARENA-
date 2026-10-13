import {
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class WebVitalDto {
  @IsIn([
    'CLS',
    'FCP',
    'INP',
    'LCP',
    'TTFB',
  ])
  name!: string;

  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  @Max(120_000)
  value!: number;

  @IsOptional()
  @IsIn([
    'good',
    'needs-improvement',
    'poor',
  ])
  rating?: string;
}

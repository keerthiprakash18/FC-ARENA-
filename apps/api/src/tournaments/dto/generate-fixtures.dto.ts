import {
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class GenerateFixturesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16)
  groupCount?: number;

  @IsOptional()
  @IsBoolean()
  shuffle?: boolean;
}

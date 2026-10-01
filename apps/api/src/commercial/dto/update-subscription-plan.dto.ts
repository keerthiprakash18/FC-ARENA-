import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateSubscriptionPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinor?: number;

  @IsOptional()
  @IsString()
  @Matches(
    /^[A-Z]{3}$/,
  )
  currency?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({
    each: true,
  })
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

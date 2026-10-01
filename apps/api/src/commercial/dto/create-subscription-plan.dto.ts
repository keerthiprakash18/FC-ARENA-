import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @IsString()
  @Matches(
    /^[A-Z0-9_]{2,50}$/,
  )
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsIn([
    'USER',
    'LEAGUE',
  ])
  audience!:
    | 'USER'
    | 'LEAGUE';

  @IsIn([
    'MONTHLY',
    'YEARLY',
  ])
  interval!:
    | 'MONTHLY'
    | 'YEARLY';

  @IsInt()
  @Min(0)
  priceMinor!: number;

  @IsString()
  @Matches(
    /^[A-Z]{3}$/,
  )
  currency!: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({
    each: true,
  })
  features!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

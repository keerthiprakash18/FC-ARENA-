import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GenerateFixturePreviewDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(128)
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  registrationIds?: string[];

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsIn([
    'BALANCED',
    'RANDOM',
    'MANUAL',
  ])
  homeAwayMode?:
    | 'BALANCED'
    | 'RANDOM'
    | 'MANUAL';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  matchdayPrefix?: string;

  @IsOptional()
  @IsISO8601({
    strict: true,
  })
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  matchdayIntervalDays?: number;

  @IsOptional()
  @Matches(
    /^([01]\d|2[0-3]):[0-5]\d$/,
  )
  defaultMatchTime?: string;
}

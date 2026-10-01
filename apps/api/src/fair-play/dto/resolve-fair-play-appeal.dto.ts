import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResolveFairPlayAppealDto {
  @IsIn([
    'UPHELD',
    'OVERTURNED',
  ])
  status!:
    | 'UPHELD'
    | 'OVERTURNED';

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  resolutionNote!: string;
}

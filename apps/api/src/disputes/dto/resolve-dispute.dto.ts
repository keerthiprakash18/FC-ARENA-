import {
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResolveDisputeDto {
  @IsIn([
    'RESOLVED',
    'REJECTED',
  ])
  status!:
    | 'RESOLVED'
    | 'REJECTED';

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  resolutionNote!: string;
}

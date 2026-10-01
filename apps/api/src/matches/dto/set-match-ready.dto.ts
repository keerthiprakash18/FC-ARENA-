import {
  IsBoolean,
  IsIn,
  IsOptional,
} from 'class-validator';

export class SetMatchReadyDto {
  @IsBoolean()
  ready!: boolean;

  @IsOptional()
  @IsIn([
    'HOME',
    'AWAY',
  ])
  side?:
    | 'HOME'
    | 'AWAY';
}

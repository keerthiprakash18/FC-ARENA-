import {
  IsIn,
} from 'class-validator';

export class DistributeTournamentGroupsDto {
  @IsIn([
    'AUTO_DISTRIBUTE',
    'RANDOM_DRAW',
  ])
  mode!:
    | 'AUTO_DISTRIBUTE'
    | 'RANDOM_DRAW';
}
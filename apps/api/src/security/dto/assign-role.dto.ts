import {
  IsIn,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class AssignRoleDto {
  @IsUUID()
  userId!: string;

  @IsIn([
    'TOURNAMENT_ADMIN',
    'TEAM_MANAGER',
    'CAPTAIN',
    'PLAYER',
    'MATCH_OFFICIAL',
    'VIEWER',
  ])
  role!:
    | 'TOURNAMENT_ADMIN'
    | 'TEAM_MANAGER'
    | 'CAPTAIN'
    | 'PLAYER'
    | 'MATCH_OFFICIAL'
    | 'VIEWER';

  @IsIn([
    'GLOBAL',
    'LEAGUE',
    'TOURNAMENT',
  ])
  scopeType!:
    | 'GLOBAL'
    | 'LEAGUE'
    | 'TOURNAMENT';

  @IsString()
  @MinLength(1)
  scopeId!: string;
}
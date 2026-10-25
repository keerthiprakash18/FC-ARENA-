import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';

export const LEAGUE_ADMIN_PERMISSIONS = [
  'MANAGE_SETTINGS',
  'MANAGE_MEMBERS',
  'MANAGE_FIXTURES',
  'MANAGE_STANDINGS',
  'MANAGE_TOURNAMENTS',
  'VIEW_REPORTS',
] as const;

export const TOURNAMENT_ADMIN_PERMISSIONS = [
  'MANAGE_FIXTURES',
  'MANAGE_RESULTS',
  'VERIFY_SCORES',
  'MANAGE_PARTICIPANTS',
  'MANAGE_SETTINGS',
  'VIEW_REPORTS',
] as const;

export type LeagueAdminPermission = (typeof LEAGUE_ADMIN_PERMISSIONS)[number];
export type TournamentAdminPermission = (typeof TOURNAMENT_ADMIN_PERMISSIONS)[number];

export class AssignResourceAdminDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(LEAGUE_ADMIN_PERMISSIONS, { each: true })
  leaguePermissions?: LeagueAdminPermission[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(TOURNAMENT_ADMIN_PERMISSIONS, { each: true })
  tournamentPermissions?: TournamentAdminPermission[];
}

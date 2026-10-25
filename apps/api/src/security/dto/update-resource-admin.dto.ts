import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
} from 'class-validator';
import {
  LEAGUE_ADMIN_PERMISSIONS,
  TOURNAMENT_ADMIN_PERMISSIONS,
  type LeagueAdminPermission,
  type TournamentAdminPermission,
} from './assign-resource-admin.dto.js';

export class UpdateResourceAdminDto {
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

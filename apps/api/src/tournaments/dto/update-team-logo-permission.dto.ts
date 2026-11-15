import { IsBoolean } from 'class-validator';

export class UpdateTeamLogoPermissionDto {
  @IsBoolean()
  allowActiveTeamLogoEdits!: boolean;
}

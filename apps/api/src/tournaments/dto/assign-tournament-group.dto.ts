import { IsUUID } from 'class-validator';

export class AssignTournamentGroupDto {
  @IsUUID()
  groupId!: string;
}

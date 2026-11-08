import { IsOptional, IsUUID } from 'class-validator';

export class CareerQueryDto {
  @IsOptional()
  @IsUUID()
  leagueId?: string;
}

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ResultQueueDto {
  @IsOptional()
  @IsIn(['PENDING_VERIFICATION', 'CONFIRMED', 'REJECTED'])
  status: 'PENDING_VERIFICATION' | 'CONFIRMED' | 'REJECTED' =
    'PENDING_VERIFICATION';

  @IsOptional() @IsUUID() tournamentId?: string;
  @IsOptional() @IsUUID() leagueId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
}

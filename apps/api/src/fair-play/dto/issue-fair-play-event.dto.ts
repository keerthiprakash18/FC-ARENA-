import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class IssueFairPlayEventDto {
  @IsUUID()
  leagueId!: string;

  @IsUUID()
  targetUserId!: string;

  @IsIn([
    'COMMENDATION',
    'WARNING',
    'LATE_RESULT',
    'NO_SHOW',
    'RESULT_INTEGRITY',
    'CONDUCT',
    'OTHER',
  ])
  kind!:
    | 'COMMENDATION'
    | 'WARNING'
    | 'LATE_RESULT'
    | 'NO_SHOW'
    | 'RESULT_INTEGRITY'
    | 'CONDUCT'
    | 'OTHER';

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsUrl({
    protocols: [
      'https',
    ],
    require_protocol:
      true,
  })
  @MaxLength(1500)
  evidenceUrl?: string;
}

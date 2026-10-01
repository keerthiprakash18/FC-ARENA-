import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GrantSubscriptionDto {
  @IsUUID()
  planId!: string;

  @IsIn([
    'USER',
    'LEAGUE',
  ])
  audience!:
    | 'USER'
    | 'LEAGUE';

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsUUID()
  targetLeagueId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

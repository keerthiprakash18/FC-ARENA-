import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReplaceTournamentPlayerDto {
  @IsUUID()
  outgoingUserId!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  replacementPlayerCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Matches, Min } from 'class-validator';
import { CreateTournamentDto } from './create-tournament.dto.js';

export class CreateStudioDraftDto extends CreateTournamentDto {
  @IsUUID('4')
  requestId!: string;
}

export class TournamentDrawDto {
  @IsUUID('4')
  requestId!: string;

  @IsIn(['MANUAL', 'PLAYER', 'AUTO', 'CLUB', 'GROUP'])
  kind!: 'MANUAL' | 'PLAYER' | 'AUTO' | 'CLUB' | 'GROUP';

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(11)
  @IsUUID('4', { each: true })
  playerIds?: string[];

  @IsOptional()
  @IsUUID('4')
  captainId?: string;

  @IsOptional()
  @IsUUID('4')
  entryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(128)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  clubs?: string[];

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(16)
  groupCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class PublishStudioDto {
  @Matches(/^[a-f0-9]{64}$/)
  revision!: string;

  @IsBoolean()
  confirmed!: boolean;
}

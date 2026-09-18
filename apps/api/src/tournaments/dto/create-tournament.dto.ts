import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsIn(['SOLO', 'DUO', 'TEAM'])
  mode!: 'SOLO' | 'DUO' | 'TEAM';

  @IsIn(['ROUND_ROBIN', 'KNOCKOUT'])
  format!: 'ROUND_ROBIN' | 'KNOCKOUT';

  @IsInt()
  @Min(2)
  @Max(128)
  maxEntries!: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(11)
  teamSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  rules?: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string;
}
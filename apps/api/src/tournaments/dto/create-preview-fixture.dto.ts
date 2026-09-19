import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePreviewFixtureDto {
  @IsUUID()
  homeRegistrationId!: string;

  @IsUUID()
  awayRegistrationId!: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsInt()
  @Min(1)
  roundNumber!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  matchday?: number;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  venue?: string;
}
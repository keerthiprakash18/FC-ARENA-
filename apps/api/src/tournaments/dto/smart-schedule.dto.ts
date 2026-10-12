import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class SmartScheduleDto {
  @IsOptional()
  @IsBoolean()
  apply?: boolean;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  slotMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  horizonDays?: number;
}

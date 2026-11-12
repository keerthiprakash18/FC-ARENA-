import { IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ProposeMatchTimeDto {
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'Start time must include an explicit time-zone offset.',
  })
  startsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

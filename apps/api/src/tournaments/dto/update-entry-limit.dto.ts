import { IsInt, Max, Min } from 'class-validator';

export class UpdateEntryLimitDto {
  @IsInt()
  @Min(2)
  @Max(128)
  maxEntries!: number;
}

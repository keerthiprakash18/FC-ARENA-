import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
export class LiveAwardRacesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000)
  offset = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12)
  limit = 6;
}

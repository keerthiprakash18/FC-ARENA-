import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReverseResultDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
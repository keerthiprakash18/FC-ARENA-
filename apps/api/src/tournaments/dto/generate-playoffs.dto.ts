import {
  IsInt,
  Max,
  Min,
} from 'class-validator';

export class GeneratePlayoffsDto {
  @IsInt()
  @Min(1)
  @Max(64)
  qualifiersPerGroup!: number;
}
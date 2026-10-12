import {
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class GeneratePlayoffsDto {
  // Kept for backward-compatible clients. New tournaments save qualification
  // settings in the wizard and do not need to resend this at generation time.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(64)
  qualifiersPerGroup?: number;
}

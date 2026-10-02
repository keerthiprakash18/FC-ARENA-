import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class VerifyAccountDeletionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

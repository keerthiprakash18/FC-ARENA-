import {
  Equals,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CompleteAccountDeletionDto {
  @IsString()
  @Equals('DELETE', {
    message:
      'Type DELETE to confirm irreversible account anonymization.',
  })
  confirm!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

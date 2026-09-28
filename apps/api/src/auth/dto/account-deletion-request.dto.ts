import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AccountDeletionRequestDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  inGameName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

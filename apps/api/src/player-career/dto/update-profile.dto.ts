import {
  IsOptional,
  IsBoolean,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string | null;

  /** A separate number from account recovery/login; never shared by default. */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsappNumber?: string | null;

  @IsOptional()
  @IsBoolean()
  whatsappShareEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  inGameName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  gameUid?: string | null;
}

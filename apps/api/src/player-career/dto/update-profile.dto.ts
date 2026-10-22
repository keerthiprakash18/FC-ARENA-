import {
  IsOptional,
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

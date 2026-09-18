import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @IsString()
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message:
      'Password must be at least 8 characters and contain at least one letter and one number.',
  })
  password!: string;

  @IsString()
  confirmPassword!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  inGameName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  gameUid?: string;
}
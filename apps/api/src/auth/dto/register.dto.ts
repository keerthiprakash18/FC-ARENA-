import {
  IsByteLength,
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
  @MaxLength(256)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter and a number.',
  })
  @IsByteLength(0, 72, { message: 'Password must be at most 72 UTF-8 bytes.' })
  password!: string;

  @IsString()
  @MaxLength(256)
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

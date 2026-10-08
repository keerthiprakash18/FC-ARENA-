import {
  IsByteLength,
  IsEmail,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @Matches(/^\d{6}$/, {
    message: 'OTP must contain exactly 6 digits.',
  })
  otp!: string;

  @IsString()
  @MaxLength(256)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message:
      'Password must be at least 8 characters and contain at least one letter and one number.',
  })
  @IsByteLength(0, 72, { message: 'Password must be at most 72 UTF-8 bytes.' })
  newPassword!: string;

  @IsString()
  @MaxLength(256)
  confirmPassword!: string;
}
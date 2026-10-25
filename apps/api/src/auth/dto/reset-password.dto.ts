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
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message:
      'Password must be at least 8 characters and contain an uppercase letter, a lowercase letter and a number.',
  })
  @IsByteLength(0, 72, { message: 'Password must be at most 72 UTF-8 bytes.' })
  newPassword!: string;

  @IsString()
  @MaxLength(256)
  confirmPassword!: string;
}

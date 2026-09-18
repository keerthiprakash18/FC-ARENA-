import { IsEmail, IsString, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @Matches(/^\d{6}$/, {
    message: 'OTP must contain exactly 6 digits.',
  })
  otp!: string;

  @IsString()
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message:
      'Password must be at least 8 characters and contain at least one letter and one number.',
  })
  newPassword!: string;

  @IsString()
  confirmPassword!: string;
}
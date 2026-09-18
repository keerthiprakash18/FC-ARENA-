import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail()
  email!: string;

  @Matches(/^\d{6}$/, {
    message: 'OTP must contain exactly 6 digits.',
  })
  otp!: string;
}
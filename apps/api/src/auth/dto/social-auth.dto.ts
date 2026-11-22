import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CompleteProfileDto } from './complete-profile.dto.js';
export class StartSocialDto {
  @IsIn(['google', 'facebook']) provider!: 'google' | 'facebook';
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) challenge!: string;
}
export class ExchangeSocialDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) code!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) state!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{43,128}$/) verifier!: string;
}
export class RegisterSocialDto extends CompleteProfileDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) ticket!: string;
  @IsString() @MinLength(2) @MaxLength(120) fullName!: string;
  @IsString() @MinLength(2) @MaxLength(80) inGameName!: string;
}
export class ConnectSocialDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) ticket!: string;
  @IsString() @MinLength(1) @MaxLength(256) password!: string;
}

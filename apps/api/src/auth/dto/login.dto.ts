import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  identifier?: string;

  /*
   * Backward compatibility for
   * older web/mobile clients.
   */
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  password!: string;
}

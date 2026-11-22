import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class CompleteProfileDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateOfBirth!: string;
  @IsString() @MinLength(8) @MaxLength(30) phoneNumber!: string;
}

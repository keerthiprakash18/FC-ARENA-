import { IsString, Matches } from 'class-validator';

export class UpdateDateOfBirthDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Enter your date of birth as YYYY-MM-DD.',
  })
  dateOfBirth!: string;
}

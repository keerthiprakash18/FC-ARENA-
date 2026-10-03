import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;

  @IsString()
  @Matches(
    /^DELETE$/,
    {
      message:
        'Type DELETE to confirm permanent account deletion.',
    },
  )
  confirmation!: string;
}

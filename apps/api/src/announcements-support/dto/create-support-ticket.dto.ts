import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  message!: string;
}

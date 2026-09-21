import {
  IsString,
  MaxLength,
  MinLength,
} from '@nestjs/class-validator';

export class AiChatDto {
  @IsString()
  @MinLength(2)
  @MaxLength(800)
  message!: string;
}

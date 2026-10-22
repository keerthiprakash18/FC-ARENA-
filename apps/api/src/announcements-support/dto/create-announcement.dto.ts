import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  body!: string;
}

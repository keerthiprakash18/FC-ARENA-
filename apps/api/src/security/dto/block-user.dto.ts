import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BlockUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  targetInGameName!: string;
}

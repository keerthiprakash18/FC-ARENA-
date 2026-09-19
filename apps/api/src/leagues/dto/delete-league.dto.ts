import {
  IsString,
  MinLength,
} from 'class-validator';

export class DeleteLeagueDto {
  @IsString()
  @MinLength(1)
  confirmName!: string;
}

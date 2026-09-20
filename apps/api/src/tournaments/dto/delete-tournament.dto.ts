import {
  IsString,
  MinLength,
} from 'class-validator';

export class DeleteTournamentDto {
  @IsString()
  @MinLength(1)
  confirmName!: string;
}

import { IsInt, Min } from 'class-validator';
import { DuoGameDto } from './duo-game.dto.js';

export class SaveDuoGameDto extends DuoGameDto {
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

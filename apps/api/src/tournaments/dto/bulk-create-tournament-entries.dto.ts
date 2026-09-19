import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  MaxLength,
} from 'class-validator';

export class BulkCreateTournamentEntriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(128)
  @ArrayUnique()
  @IsString({
    each: true,
  })
  @MaxLength(120, {
    each: true,
  })
  names!: string[];
}
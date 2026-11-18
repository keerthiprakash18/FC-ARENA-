import { IsIn, IsString, MaxLength } from 'class-validator';

/**
 * The organizer chooses the knockout field explicitly. No live competition
 * gets a guessed qualifier count, and the final bracket is not drawn early.
 */
export class EnableLeaguePlayoffsDto {
  @IsIn([4, 8, 16])
  playoffQualifiersTotal!: 4 | 8 | 16;

  @IsIn(['GLOBAL_SEEDED', 'PROTECTED_SEED', 'DOUBLE_CHANCE'])
  playoffFormat!: 'GLOBAL_SEEDED' | 'PROTECTED_SEED' | 'DOUBLE_CHANCE';

  @IsString()
  @MaxLength(120)
  confirmation!: string;
}

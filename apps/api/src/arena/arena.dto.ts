import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ArenaSubscriptionDto {
  @IsBoolean() subscribed!: boolean;
}

export class ArenaMuteDto {
  @IsBoolean() muted!: boolean;
}
export const ARENA_KINDS = [
  'DISCUSSION',
  'QUESTION',
  'NEWS',
  'RUMOUR',
] as const;
export const REPORT_REASONS = [
  'HARASSMENT_OR_BULLYING',
  'HATE_OR_ABUSE',
  'SPAM_OR_SCAM',
  'IMPERSONATION',
  'INAPPROPRIATE_CONTENT',
  'OTHER',
] as const;

export class CreateArenaPostDto {
  @IsUUID() clientRequestId!: string;
  @IsIn(['PUBLIC', 'LEAGUE']) audience!: 'PUBLIC' | 'LEAGUE';
  @IsOptional() @IsUUID() leagueId?: string;
  @IsIn(ARENA_KINDS) kind!: (typeof ARENA_KINDS)[number];
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(2000) body!: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  pollOptions?: string[];
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? Number(value) : value,
  )
  @IsIn([24, 72, 168])
  pollDurationHours?: number;
}

export class EditArenaPostDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(2000) body!: string;
  @IsOptional() @IsBoolean() removeImage?: boolean;
}
export class CreateArenaCommentDto {
  @IsUUID() clientRequestId!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(1000) body!: string;
}
export class EditArenaCommentDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(1000) body!: string;
}
export class ArenaReactionDto {
  @IsBoolean() liked!: boolean;
}
export class ArenaVoteDto {
  @IsUUID() optionId!: string;
}
export class ArenaHideDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason?: string;
}
export class ArenaReportDto {
  @IsIn(REPORT_REASONS) reason!: (typeof REPORT_REASONS)[number];
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) details?: string;
}
export class ResolveArenaReportDto {
  @IsIn(['HIDE', 'DISMISS']) action!: 'HIDE' | 'DISMISS';
  @Transform(trim) @IsString() @MinLength(5) @MaxLength(500) note!: string;
}

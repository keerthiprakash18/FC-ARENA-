import {
  Type,
} from 'class-transformer';

import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AiChatHistoryItemDto {
  @IsIn([
    'user',
    'assistant',
  ])
  role!:
    | 'user'
    | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}

export class AiChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({
    each: true,
  })
  @Type(() =>
    AiChatHistoryItemDto,
  )
  history?:
    AiChatHistoryItemDto[];
}

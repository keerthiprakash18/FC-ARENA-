import {
  IsOptional,
  IsUUID,
} from 'class-validator';

export class PublishFixturePreviewDto {
  @IsOptional()
  @IsUUID()
  groupId?: string;
}

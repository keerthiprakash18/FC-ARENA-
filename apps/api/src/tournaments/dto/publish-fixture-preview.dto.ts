import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class PublishFixturePreviewDto {
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(128)
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  registrationIds?: string[];
}

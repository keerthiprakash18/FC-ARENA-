import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

class ReorganizedGroupDto {
  @IsUUID() id!: string;
  @IsString() @MinLength(1) @MaxLength(40) name!: string;
  @IsArray() @ArrayMaxSize(512) @IsUUID('all', { each: true }) registrationIds!: string[];
}
export class ReorganizeTournamentGroupsDto {
  @IsString() @Matches(/^[0-9a-f]{64}$/) revision!: string;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(16) @ValidateNested({ each: true }) @Type(() => ReorganizedGroupDto) groups!: ReorganizedGroupDto[];
}
export class ApplyTournamentGroupsDto extends ReorganizeTournamentGroupsDto {
  @IsString() @Matches(/^[0-9a-f]{64}$/) planHash!: string;
}

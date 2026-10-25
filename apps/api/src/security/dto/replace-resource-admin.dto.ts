import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class ReplaceResourceAdminDto {
  @IsUUID()
  replacementUserId!: string;

  @IsOptional()
  @IsBoolean()
  transferOwnership?: boolean;
}

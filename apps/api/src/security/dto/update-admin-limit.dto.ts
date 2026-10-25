import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateAdminLimitDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAdmins?: number | null;
}

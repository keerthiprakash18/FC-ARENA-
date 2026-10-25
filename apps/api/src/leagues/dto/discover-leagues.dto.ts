import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class DiscoverLeaguesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsIn(['POPULAR', 'NEWEST', 'ACTIVE'])
  sort?: 'POPULAR' | 'NEWEST' | 'ACTIVE';

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

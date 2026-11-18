import { IsString, IsUUID, Length, Matches, MaxLength, MinLength, IsOptional } from 'class-validator';

export class CreateClubDto {
  @IsString() @MinLength(3) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(400) description?: string;
}

export class JoinClubDto {
  @IsString() @Length(24, 24) @Matches(/^[0-9a-fA-F]{24}$/)
  inviteCode!: string;
}

export class LinkClubEntryDto {
  @IsUUID('4') registrationId!: string;
}

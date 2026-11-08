import { IsUUID } from 'class-validator';

export class SwapTournamentGroupEntriesDto {
  @IsUUID()
  registrationId!: string;

  @IsUUID()
  otherRegistrationId!: string;
}

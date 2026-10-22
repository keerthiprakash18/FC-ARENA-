import { IsIn } from 'class-validator';

export class UpdateSupportTicketDto {
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  status!: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
}

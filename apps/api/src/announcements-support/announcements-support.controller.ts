import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto.js';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto.js';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto.js';
import { AnnouncementsSupportService } from './announcements-support.service.js';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

@Controller()
@UseGuards(JwtAuthGuard)
export class AnnouncementsSupportController {
  constructor(private readonly service: AnnouncementsSupportService) {}

  @Get('announcements')
  listAnnouncements(@Req() request: AuthenticatedRequest) {
    return this.service.listAnnouncements(request.user.sub);
  }

  @Post('announcements')
  createAnnouncement(@Req() request: AuthenticatedRequest, @Body() dto: CreateAnnouncementDto) {
    return this.service.createAnnouncement(request.user.sub, dto);
  }

  @Get('support-tickets')
  listTickets(@Req() request: AuthenticatedRequest) {
    return this.service.listTickets(request.user.sub);
  }

  @Post('support-tickets')
  createTicket(@Req() request: AuthenticatedRequest, @Body() dto: CreateSupportTicketDto) {
    return this.service.createTicket(request.user.sub, dto);
  }

  @Get('support-tickets/:ticketId')
  getTicket(@Req() request: AuthenticatedRequest, @Param('ticketId') ticketId: string) {
    return this.service.getTicket(request.user.sub, ticketId);
  }

  @Post('support-tickets/:ticketId/messages')
  addMessage(
    @Req() request: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateTicketMessageDto,
  ) {
    return this.service.addMessage(request.user.sub, ticketId, dto);
  }

  @Patch('support-tickets/:ticketId')
  updateTicket(
    @Req() request: AuthenticatedRequest,
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.service.updateTicket(request.user.sub, ticketId, dto);
  }
}

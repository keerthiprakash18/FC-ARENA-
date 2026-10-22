import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateAnnouncementDto } from './dto/create-announcement.dto.js';
import type { CreateSupportTicketDto } from './dto/create-support-ticket.dto.js';
import type { CreateTicketMessageDto } from './dto/create-ticket-message.dto.js';
import type { UpdateSupportTicketDto } from './dto/update-support-ticket.dto.js';

const userSelect = { id: true, fullName: true } as const;

@Injectable()
export class AnnouncementsSupportService {
  constructor(private readonly prisma: PrismaService) {}

  async listAnnouncements(userId: string) {
    const announcements = await this.prisma.announcement.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      include: { createdBy: { select: userSelect } },
    });
    return { success: true, data: { announcements, canPublish: await this.isManager(userId) }, error: null };
  }

  async createAnnouncement(userId: string, dto: CreateAnnouncementDto) {
    await this.assertManager(userId);
    const announcement = await this.prisma.announcement.create({
      data: { title: dto.title.trim(), body: dto.body.trim(), createdByUserId: userId },
      include: { createdBy: { select: userSelect } },
    });
    return { success: true, data: { announcement }, error: null };
  }

  async listTickets(userId: string) {
    const manager = await this.isManager(userId);
    const tickets = await this.prisma.supportTicket.findMany({
      where: manager ? undefined : { createdByUserId: userId },
      orderBy: { updatedAt: 'desc' },
      include: this.ticketInclude,
    });
    return { success: true, data: { tickets, isManager: manager }, error: null };
  }

  async createTicket(userId: string, dto: CreateSupportTicketDto) {
    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: { createdByUserId: userId, subject: dto.subject.trim() },
      });
      await tx.supportTicketMessage.create({
        data: { ticketId: created.id, authorUserId: userId, body: dto.message.trim() },
      });
      return tx.supportTicket.findUniqueOrThrow({ where: { id: created.id }, include: this.ticketInclude });
    });
    return { success: true, data: { ticket }, error: null };
  }

  async getTicket(userId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId }, include: this.ticketInclude });
    if (!ticket) throw this.notFound();
    await this.assertTicketAccess(userId, ticket.createdByUserId);
    return { success: true, data: { ticket }, error: null };
  }

  async addMessage(userId: string, ticketId: string, dto: CreateTicketMessageDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw this.notFound();
    const manager = await this.isManager(userId);
    if (ticket.createdByUserId !== userId && !manager) throw this.forbidden();
    if (ticket.status === 'CLOSED') {
      throw new ForbiddenException({ success: false, data: null, error: { code: 'TICKET_CLOSED', message: 'Closed tickets cannot receive new messages.' } });
    }
    const message = await this.prisma.supportTicketMessage.create({
      data: { ticketId, authorUserId: userId, body: dto.body.trim() },
      include: { author: { select: userSelect } },
    });
    return { success: true, data: { message }, error: null };
  }

  async updateTicket(userId: string, ticketId: string, dto: UpdateSupportTicketDto) {
    await this.assertManager(userId);
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw this.notFound();
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: dto.status, assignedToUserId: userId },
      include: this.ticketInclude,
    });
    return { success: true, data: { ticket: updated }, error: null };
  }

  private readonly ticketInclude = {
    createdBy: { select: userSelect },
    assignedTo: { select: userSelect },
    messages: { orderBy: { createdAt: 'asc' as const }, include: { author: { select: userSelect } } },
  } as const;

  private async isManager(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role === 'SUPER_ADMIN') return true;
    return Boolean(await this.prisma.leagueAdmin.findFirst({ where: { userId }, select: { id: true } }));
  }

  private async assertManager(userId: string) {
    if (!(await this.isManager(userId))) throw this.forbidden('MANAGER_REQUIRED', 'Organizer or administrator access is required.');
  }

  private async assertTicketAccess(userId: string, ownerId: string) {
    if (ownerId !== userId && !(await this.isManager(userId))) throw this.forbidden();
  }

  private forbidden(code = 'SUPPORT_FORBIDDEN', message = 'You do not have access to this support action.') {
    return new ForbiddenException({ success: false, data: null, error: { code, message } });
  }

  private notFound() {
    return new NotFoundException({ success: false, data: null, error: { code: 'SUPPORT_TICKET_NOT_FOUND', message: 'Support ticket could not be found.' } });
  }
}

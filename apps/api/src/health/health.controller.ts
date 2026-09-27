import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async checkHealth() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      success: true,
      data: {
        application: 'FC ARENA API',
        api: 'connected',
        database: 'connected',
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
      error: null,
    };
  }
}
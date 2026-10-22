import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AnnouncementsSupportController } from './announcements-support.controller.js';
import { AnnouncementsSupportService } from './announcements-support.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AnnouncementsSupportController],
  providers: [AnnouncementsSupportService],
})
export class AnnouncementsSupportModule {}

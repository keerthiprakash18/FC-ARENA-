import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ArenaController, ArenaMediaController } from './arena.controller.js';
import { ArenaMediaService } from './arena-media.service.js';
import { ArenaService } from './arena.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ArenaController, ArenaMediaController],
  providers: [ArenaService, ArenaMediaService],
})
export class ArenaModule {}

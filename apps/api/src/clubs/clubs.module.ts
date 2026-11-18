import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ClubsController } from './clubs.controller.js';
import { ClubsService } from './clubs.service.js';

@Module({ imports: [AuthModule], controllers: [ClubsController], providers: [ClubsService] })
export class ClubsModule {}

import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';

import {
  PublicService,
} from './public.service.js';

@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService:
      PublicService,
  ) {}

  @Get(
    'tournaments/:code',
  )
  getTournament(
    @Param('code')
    code: string,
  ) {
    return this.publicService.getTournament(
      code,
    );
  }

  @Get('tournaments/:code/export')
  exportTournament(
    @Param('code') code: string,
    @Query('format') format?: string,
  ) {
    return this.publicService.exportTournament(code, format);
  }
}

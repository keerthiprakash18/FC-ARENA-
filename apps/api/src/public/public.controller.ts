import {
  Controller,
  Get,
  Param,
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
}

import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from './auth.types.js';
import { DateOfBirthService } from './date-of-birth.service.js';
import { UpdateDateOfBirthDto } from './dto/update-date-of-birth.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Controller('auth/me')
@UseGuards(JwtAuthGuard)
export class DateOfBirthController {
  constructor(private readonly dateOfBirth: DateOfBirthService) {}

  @Patch('date-of-birth')
  update(
    @Req() request: Request & { user: AccessTokenPayload },
    @Body() dto: UpdateDateOfBirthDto,
  ) {
    return this.dateOfBirth.update(request.user.sub, dto.dateOfBirth);
  }
}

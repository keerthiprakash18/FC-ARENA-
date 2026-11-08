import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

export function parseDateOfBirth(value: string, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value < '1900-01-01' ||
    value > today
  ) {
    throw new BadRequestException({
      success: false,
      data: null,
      error: {
        code: 'INVALID_DATE_OF_BIRTH',
        message: 'Enter a real date of birth between 1 January 1900 and today.',
      },
    });
  }
  return date;
}

@Injectable()
export class DateOfBirthService {
  constructor(private readonly prisma: PrismaService) {}

  async update(userId: string, value: string) {
    const dateOfBirth = parseDateOfBirth(value);
    const result = await this.prisma.user.updateMany({
      // An in-flight request must not restore personal data after account deletion.
      where: { id: userId, status: 'ACTIVE' },
      data: { dateOfBirth },
    });
    if (result.count !== 1)
      throw new UnauthorizedException({
        success: false,
        data: null,
        error: {
          code: 'ACCOUNT_NOT_ACTIVE',
          message:
            'Sign in to an active account before updating your date of birth.',
        },
      });
    return {
      success: true,
      data: {
        dateOfBirth: dateOfBirth.toISOString().slice(0, 10),
        message: 'Date of birth saved.',
      },
      error: null,
    };
  }
}

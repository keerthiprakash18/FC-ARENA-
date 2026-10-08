import 'dotenv/config';
import {
  Injectable,
  ConflictException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is missing. Check apps/api/.env before starting FC ARENA API.',
      );
    }

    const adapter = new PrismaPg({
      connectionString,
    });

    super({
      adapter,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  // Retry only transactions PostgreSQL/Prisma explicitly rolled back for a
  // serialization conflict/deadlock. Callbacks must contain database work only;
  // notifications and other external side effects run after a successful commit.
  async $transactionWithRetry<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel } = {},
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.$transaction(work, options);
      } catch (error) {
        const prismaConflict = typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
        // Prisma 7's PostgreSQL adapter can surface commit-time serialization
        // failures directly instead of wrapping them as P2034.
        const cause = error instanceof Error ? error.cause : undefined;
        const adapterConflict = error instanceof Error && error.name === 'DriverAdapterError' &&
          typeof cause === 'object' && cause !== null && 'kind' in cause && cause.kind === 'TransactionWriteConflict' &&
          'originalCode' in cause && ['40001', '40P01'].includes(String(cause.originalCode));
        if (!prismaConflict && !adapterConflict) throw error;
        if (attempt === 2) {
          throw new ConflictException({ success: false, data: null, error: {
            code: 'CONCURRENT_UPDATE', message: 'Another update is in progress. Please retry.',
          } });
        }
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
      }
    }
    throw new Error('Unreachable transaction retry state.');
  }
}
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from './prisma.service.js';

describe('Transaction retry safety', () => {
  function service(error: unknown) {
    const prisma = Object.create(PrismaService.prototype) as PrismaService;
    const transaction = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('committed');
    Object.defineProperty(prisma, '$transaction', { value: transaction });
    return { prisma, transaction };
  }

  it('retries the adapter commit-time serialization error', async () => {
    const error = new Error('TransactionWriteConflict', { cause: { kind: 'TransactionWriteConflict', originalCode: '40001' } });
    error.name = 'DriverAdapterError';
    const f = service(error);
    await expect(f.prisma.$transactionWithRetry(async () => 'committed')).resolves.toBe('committed');
    expect(f.transaction).toHaveBeenCalledTimes(2);
  });

  it('never replays unknown storage/connection/commit failures', async () => {
    const error = new Error('Connection lost while committing');
    const f = service(error);
    await expect(f.prisma.$transactionWithRetry(async () => 'committed')).rejects.toBe(error);
    expect(f.transaction).toHaveBeenCalledTimes(1);
  });

  it('returns a bounded conflict after three explicitly rolled-back attempts', async () => {
    const f = service({ code: 'P2034' });
    f.transaction.mockRejectedValue({ code: 'P2034' });
    await expect(f.prisma.$transactionWithRetry(async () => 'committed')).rejects.toMatchObject({ status: 409 });
    expect(f.transaction).toHaveBeenCalledTimes(3);
  });
});

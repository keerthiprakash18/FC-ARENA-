import { describe, expect, it, vi } from 'vitest';
import { ResultReviewService } from './result-review.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { AuthorizationService } from '../security/authorization.service.js';

describe('admin result queue snapshot', () => {
  function setup(allowed = true) {
    const scope = { id: 'permitted-tournament' };
    const submissions = [{ id: 'submission-21' }];
    const db = {
      tournament: { findMany: vi.fn().mockResolvedValue(allowed ? [{ id: scope.id }] : []) },
      resultSubmission: {
        count: vi.fn((_args: { where: unknown }) => Promise.resolve(21)),
        findMany: vi.fn().mockResolvedValue(submissions),
      },
      $transaction: vi.fn((reads: Promise<unknown>[]) => Promise.all(reads)),
    };
    const auth = { resultVerificationScope: vi.fn().mockResolvedValue(scope) };
    return { db, auth, scope, submissions, service: new ResultReviewService(db as unknown as PrismaService, auth as unknown as AuthorizationService) };
  }

  it('uses one repeatable read snapshot for the count and page without changing scope or ordering', async () => {
    const { db, auth, scope, submissions, service } = setup();
    const result = await service.queue('verifier', { status: 'PENDING_VERIFICATION', page: 2 });
    expect(auth.resultVerificationScope).toHaveBeenCalledWith('verifier');
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Array), { isolationLevel: 'RepeatableRead' });
    const where = db.resultSubmission.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: 'PENDING_VERIFICATION', match: { tournament: { AND: [scope, {}] }, confirmedResultSubmissionId: null } });
    expect(db.resultSubmission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where, skip: 20, take: 20, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }));
    expect(result.data).toMatchObject({ total: 21, page: 2, pageSize: 20, submissions });
  });

  it('refuses unauthorized scope before any result query', async () => {
    const { db, service } = setup(false);
    await expect(service.queue('unauthorized', { status: 'PENDING_VERIFICATION', page: 1 })).rejects.toMatchObject({ status: 403 });
    expect(db.resultSubmission.count).not.toHaveBeenCalled();
    expect(db.resultSubmission.findMany).not.toHaveBeenCalled();
  });
});

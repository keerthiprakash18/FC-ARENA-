import { describe, expect, it, vi } from 'vitest';
import { assertUclReturnLegReady, getUclReturnLegAccess, uclWinner } from './ucl-ties.js';
import { OcrService } from '../ocr/ocr.service.js';
import { ResultsService } from './results.service.js';
import sharp from 'sharp';
import { unlink } from 'node:fs/promises';

vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(), unlink: vi.fn().mockResolvedValue(undefined) }));

const fixture = { id: 'leg2', tournamentId: 'cup', phase: 'PLAYOFF', roundNumber: 1,
  roundName: 'UCL QUARTER-FINAL · LEG 2', bracketPosition: 1, matchday: 2, homeRegistrationId: 'B', awayRegistrationId: 'A' };
const verified = { id: 'leg1', fixtureCode: 'F1', homeRegistrationId: 'A', awayRegistrationId: 'B', status: 'COMPLETED',
  match: { id: 'first-match', status: 'COMPLETED', confirmedResult: { status: 'CONFIRMED', homeScore: 3, awayScore: 1 } } };

describe('Return-leg result access', () => {
  it.each([null, { ...verified, status: 'SCHEDULED' }, { ...verified, match: { ...verified.match, status: 'SCHEDULED' } },
    { ...verified, match: { ...verified.match, confirmedResult: { ...verified.match.confirmedResult, status: 'PENDING_VERIFICATION' } } },
    { ...verified, match: { ...verified.match, confirmedResult: null } }, { ...verified, homeRegistrationId: 'C' }])(
    'blocks missing, unverified, reversed or mismatched first legs', async first => {
      const tx = { fixture: { findFirst: vi.fn().mockResolvedValue(first) } };
      expect(await getUclReturnLegAccess(tx, fixture)).toMatchObject({ canUpload: false, firstLegScore: null });
      await expect(assertUclReturnLegReady(tx, fixture)).rejects.toMatchObject({ response: { error: { code: 'FIRST_LEG_NOT_CONFIRMED' } } });
    });
  it('unlocks the correct return leg and exposes the verified score in its team order', async () => {
    const tx = { fixture: { findFirst: vi.fn().mockResolvedValue(verified) } };
    expect(await getUclReturnLegAccess(tx, fixture)).toMatchObject({ canUpload: true, firstLegMatchId: 'first-match', firstLegScore: { homeScore: 1, awayScore: 3 } });
    await expect(uclWinner(tx, fixture, { homeScore: 1, awayScore: 0 })).resolves.toBe('A');
    expect(tx.fixture.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { tournamentId: 'cup', phase: 'PLAYOFF', roundNumber: 1, bracketPosition: 1, matchday: 1 } }));
  });
  it('keeps first legs, finals and league matchdays independent', async () => {
    const tx = { fixture: { findFirst: vi.fn() } };
    for (const other of [{ ...fixture, matchday: 1 }, { ...fixture, roundName: 'UCL FINAL', matchday: null }, { ...fixture, phase: 'STAGE' }]) {
      await expect(getUclReturnLegAccess(tx, other)).resolves.toBeNull();
    }
    expect(tx.fixture.findFirst).not.toHaveBeenCalled();
  });
  it('rejects screenshot upload before storage, extraction creation or OCR queueing', async () => {
    const db = { fixture: { findFirst: vi.fn().mockResolvedValue(null) }, ocrExtraction: { create: vi.fn() } };
    const queue = { add: vi.fn() };
    const service = new OcrService(db as never, {} as never, queue as never, {} as never, {} as never);
    vi.spyOn(service as unknown as { getAuthorizedMatch(): Promise<object> }, 'getAuthorizedMatch').mockResolvedValue({ tournament: { competitionFormat: 'UCL_CUP' }, fixture });
    await expect(service.uploadScreenshot('user', 'second-match', {} as never)).rejects.toMatchObject({ response: { error: { code: 'FIRST_LEG_NOT_CONFIRMED' } } });
    expect(db.ocrExtraction.create).not.toHaveBeenCalled(); expect(queue.add).not.toHaveBeenCalled();
    db.fixture.findFirst.mockResolvedValue(verified as never);
    await expect(service.uploadScreenshot('user', 'second-match', {} as never)).rejects.toMatchObject({ response: { error: { code: 'SCREENSHOT_REQUIRED' } } });
  });
  it.each([{}, { ocrExtractionId: 'existing-ocr' }])('rechecks the first leg inside the result transaction for source %j', async source => {
    const match = { id: 'second-match', status: 'SCHEDULED', tournament: { competitionFormat: 'UCL_CUP' }, fixture: { ...fixture, homeRegistration: { members: [{ userId: 'user' }] } } };
    const db = { match: { findUnique: vi.fn().mockResolvedValue(match) }, fixture: { findFirst: vi.fn().mockResolvedValue(null) }, resultSubmission: { create: vi.fn() },
      $transactionWithRetry: vi.fn(async work => work(db)) };
    const service = new ResultsService(db as never, { canVerifyResult: vi.fn().mockResolvedValue(false) } as never, {} as never);
    vi.spyOn(service as unknown as { assertPairNotAlreadyCompleted(): Promise<void> }, 'assertPairNotAlreadyCompleted').mockResolvedValue(undefined);
    await expect(service.submitResult('user', 'second-match', { homeScore: 1, awayScore: 0 }, source)).rejects.toMatchObject({ response: { error: { code: 'FIRST_LEG_NOT_CONFIRMED' } } });
    expect(db.resultSubmission.create).not.toHaveBeenCalled();
    expect(db.$transactionWithRetry).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
  it.each([false, true])('rechecks screenshot eligibility atomically after the image is saved: first leg still verified = %s', async stillVerified => {
    const current = { id: 'second-match', fixture };
    const create = vi.fn().mockResolvedValue({ id: 'ocr', status: 'QUEUED' });
    const tx = { match: { findUnique: vi.fn().mockResolvedValue(current) }, fixture: { findFirst: vi.fn().mockResolvedValue(stillVerified ? verified : null) }, ocrExtraction: { create } };
    const db = { fixture: { findFirst: vi.fn().mockResolvedValue(verified) }, $transactionWithRetry: vi.fn(async work => work(tx)) };
    const queue = { add: vi.fn() };
    const service = new OcrService(db as never, {} as never, queue as never, {} as never, {} as never);
    vi.spyOn(service as unknown as { getAuthorizedMatch(): Promise<object> }, 'getAuthorizedMatch').mockResolvedValue({ ...current, tournament: { competitionFormat: 'UCL_CUP' } });
    const buffer = await sharp({ create: { width: 640, height: 360, channels: 3, background: '#123456' } }).png().toBuffer();
    const request = service.uploadScreenshot('user', 'second-match', { buffer, size: buffer.length, mimetype: 'image/png' } as never);
    if (stillVerified) {
      await expect(request).resolves.toMatchObject({ data: { extraction: { id: 'ocr', status: 'QUEUED' } } });
      expect(create).toHaveBeenCalledTimes(1); expect(queue.add).toHaveBeenCalledTimes(1);
    } else {
      await expect(request).rejects.toMatchObject({ response: { error: { code: 'FIRST_LEG_NOT_CONFIRMED' } } });
      expect(create).not.toHaveBeenCalled(); expect(queue.add).not.toHaveBeenCalled();
      expect(unlink).toHaveBeenCalledWith(expect.stringContaining('second-match'));
    }
    expect(db.$transactionWithRetry).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
});

import { mkdir, mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { OcrService } from './ocr.service.js';
import { OcrProcessor } from './ocr.processor.js';
import { OCR_JOB_PROCESS_MATCH_RESULT } from './ocr.constants.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs/promises')>();
  return { ...fs, mkdir: vi.fn(fs.mkdir), writeFile: vi.fn(fs.writeFile) };
});

let directory: string;
let imagePath: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'fc-ocr-retry-'));
  imagePath = join(directory, 'screenshot.png');
  await writeFile(imagePath, 'screenshot');
});
afterEach(async () => {
  await unlink(imagePath);
  await rmdir(directory);
  vi.unstubAllEnvs();
});

describe('OCR queue lifecycle', () => {
  it.each(['EACCES', 'EROFS', 'ENOSPC'])('reports an actionable upload error for storage failure %s', async (code) => {
    vi.mocked(mkdir).mockRejectedValueOnce(Object.assign(new Error('/private/server/path'), { code }));
    const image = await sharp({ create: { width: 640, height: 360, channels: 3, background: '#123456' } }).png().toBuffer();
    const prisma = { ocrExtraction: { create: vi.fn() } };
    const queue = { add: vi.fn() };
    const service = new OcrService(prisma as never, {} as never, queue as never, {} as never, {} as never);
    vi.spyOn(service as unknown as { getAuthorizedMatch(): Promise<object> }, 'getAuthorizedMatch').mockResolvedValue({});
    try {
      await service.uploadScreenshot('alice', 'match', { buffer: image, size: image.length, mimetype: 'image/png' } as never);
      expect.fail('unwritable storage must fail');
    } catch (error) {
      const exception = error as { getStatus(): number; getResponse(): unknown };
      expect(exception.getStatus()).toBe(503);
      expect(exception.getResponse()).toMatchObject({ error: { code: 'OCR_STORAGE_UNAVAILABLE' } });
      expect(JSON.stringify(exception.getResponse())).not.toContain('/private/server/path');
    }
    expect(prisma.ocrExtraction.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'shows failure only after the final attempt = %s',
    async (finalAttempt) => {
      const prisma = {
        ocrExtraction: {
          findUnique: vi
            .fn()
            .mockResolvedValue({
              id: 'ocr',
              imagePath,
              match: { fixture: {} },
            }),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      const service = new OcrService(
        prisma as never,
        {} as never,
        {} as never,
        {
          extract: vi
            .fn()
            .mockRejectedValue(new Error('temporary worker error')),
        } as never,
        {} as never,
      );
      await expect(
        service.processExtraction('ocr', finalAttempt),
      ).rejects.toThrow('temporary worker error');
      expect(prisma.ocrExtraction.update).toHaveBeenLastCalledWith({
        where: { id: 'ocr' },
        data: {
          status: finalAttempt ? 'FAILED' : 'QUEUED',
          failureReason: finalAttempt ? expect.any(String) : null,
          processedAt: finalAttempt ? expect.any(Date) : null,
        },
      });
    },
  );

  it.each([0, 1])(
    'passes the actual queue attempt %s to processing',
    async (attemptsMade) => {
      const service = { processExtraction: vi.fn().mockResolvedValue({}) };
      const processor = new OcrProcessor(service as never);
      await processor.process({
        name: OCR_JOB_PROCESS_MATCH_RESULT,
        data: { ocrExtractionId: 'ocr' },
        attemptsMade,
        opts: { attempts: 2 },
      } as never);
      expect(service.processExtraction).toHaveBeenCalledWith(
        'ocr',
        attemptsMade === 1,
      );
    },
  );

  it('does not leave an upload queued forever when enqueueing fails', async () => {
    vi.stubEnv('OCR_UPLOAD_DIR', directory);
    const image = await sharp({
      create: { width: 640, height: 360, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();
    let storedPath = '';
    const prisma = {
      ocrExtraction: {
        create: vi.fn(async ({ data }: any) => {
          storedPath = data.imagePath;
          return { id: 'ocr', ...data };
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const service = new OcrService(
      prisma as never,
      {} as never,
      {
        add: vi.fn().mockRejectedValue(new Error('queue unavailable')),
      } as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(
      service as unknown as { getAuthorizedMatch(): Promise<object> },
      'getAuthorizedMatch',
    ).mockResolvedValue({});
    try {
      await expect(
        service.uploadScreenshot('alice', 'match', {
          buffer: image,
          size: image.length,
          mimetype: 'image/png',
        } as never),
      ).rejects.toThrow('temporarily unavailable');
      expect(prisma.ocrExtraction.update).toHaveBeenCalledWith({
        where: { id: 'ocr' },
        data: {
          status: 'FAILED',
          failureReason: expect.stringContaining('manually'),
          processedAt: expect.any(Date),
        },
      });
      expect(await readFile(storedPath)).toEqual(image);
    } finally {
      if (storedPath) await unlink(storedPath);
      await rmdir(join(directory, 'match'));
    }
  });
});

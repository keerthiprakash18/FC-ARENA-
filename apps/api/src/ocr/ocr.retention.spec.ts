import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OcrService } from './ocr.service.js';

const tempDirectories: string[] = [];

afterEach(async () => {
  delete process.env.OCR_UPLOAD_DIR;
  for (const directory of tempDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('OCR artifact retention', () => {
  it('removes stale unsubmitted artifacts while preserving result evidence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fc-arena-ocr-'));
    tempDirectories.push(directory);
    process.env.OCR_UPLOAD_DIR = directory;
    const imagePath = join(directory, 'stale.png');
    await writeFile(imagePath, 'image');

    const findMany = vi.fn().mockResolvedValue([
      { id: 'stale', imagePath },
    ]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      ocrExtraction: { findMany, deleteMany },
    };
    const service = new OcrService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.cleanupExpiredArtifacts(60_000)).resolves.toBe(1);
    await expect(readFile(imagePath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expect.any(Date) },
        status: { in: ['COMPLETED', 'FAILED'] },
        resultSubmission: { is: null },
      },
      select: { id: true, imagePath: true },
      take: 500,
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'stale',
        resultSubmission: { is: null },
      },
    });
  });

  it('does not delete files outside the configured OCR root', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fc-arena-ocr-'));
    tempDirectories.push(directory);
    process.env.OCR_UPLOAD_DIR = directory;
    const outsidePath = join(tmpdir(), 'fc-arena-ocr-outside.png');
    await writeFile(outsidePath, 'keep');
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new OcrService(
      { ocrExtraction: {
        findMany: async () => [{ id: 'outside', imagePath: outsidePath }],
        deleteMany,
      } } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.cleanupExpiredArtifacts(60_000)).resolves.toBe(0);
    await expect(readFile(outsidePath)).resolves.toEqual(Buffer.from('keep'));
    expect(deleteMany).not.toHaveBeenCalled();
    await rm(outsidePath, { force: true });
  });
});

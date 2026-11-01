import { mkdtemp, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorker, PSM, type Page } from 'tesseract.js';
import {
  TesseractOcrProvider,
  visualRows,
} from './providers/tesseract-ocr.provider.js';

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(),
  PSM: { SPARSE_TEXT: '11', AUTO: '3' },
}));

const page = { text: 'Alpha 2 - 1 Beta', confidence: 95, blocks: null } as Page;
const worker = {
  setParameters: vi.fn(),
  recognize: vi.fn(),
  terminate: vi.fn(),
};
let directory: string;
let imagePath: string;
let provider: TesseractOcrProvider;

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(createWorker).mockResolvedValue(worker as never);
  worker.recognize.mockResolvedValue({ data: page });
  worker.terminate.mockResolvedValue({});
  directory = await mkdtemp(join(tmpdir(), 'fc-ocr-provider-'));
  imagePath = join(directory, 'screenshot.png');
  await sharp({
    create: { width: 640, height: 360, channels: 3, background: '#123456' },
  })
    .png()
    .toFile(imagePath);
  provider = new TesseractOcrProvider();
});

afterEach(async () => {
  await provider.onModuleDestroy();
  await unlink(imagePath);
  await rmdir(directory);
});

describe('OCR preprocessing and worker recovery', () => {
  it('prepares an enlarged image and requests geometry in both layout passes', async () => {
    const extracted = await provider.extract(imagePath);
    expect(extracted.text).toBe(page.text);
    expect(extracted.alternatives).toHaveLength(1);
    expect(
      worker.setParameters.mock.calls.map(
        ([params]) => params.tessedit_pageseg_mode,
      ),
    ).toEqual([PSM.SPARSE_TEXT, PSM.AUTO]);
    expect(worker.recognize).toHaveBeenCalledWith(
      expect.any(Buffer),
      {},
      { text: true, blocks: true },
    );
    const metadata = await sharp(worker.recognize.mock.calls[0][0]).metadata();
    expect(metadata.width).toBe(1600);
    expect(metadata.height).toBe(900);
    expect((await sharp(imagePath).metadata()).width).toBe(640);
  });

  it('retries worker initialization after a failure', async () => {
    vi.mocked(createWorker).mockRejectedValueOnce(
      new Error('temporary initialization failure'),
    );
    await expect(provider.extract(imagePath)).rejects.toThrow(
      'temporary initialization failure',
    );
    await expect(provider.extract(imagePath)).resolves.toMatchObject({
      text: page.text,
    });
    expect(createWorker).toHaveBeenCalledTimes(2);
  });

  it('replaces a failed worker before the queue retries recognition', async () => {
    worker.recognize.mockRejectedValueOnce(
      new Error('temporary recognition failure'),
    );
    await expect(provider.extract(imagePath)).rejects.toThrow(
      'temporary recognition failure',
    );
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    await expect(provider.extract(imagePath)).resolves.toMatchObject({
      text: page.text,
    });
    expect(createWorker).toHaveBeenCalledTimes(2);
  });

  it('serializes simultaneous uploads so their page modes cannot interfere', async () => {
    let active = 0,
      maximum = 0;
    worker.recognize.mockImplementation(async () => {
      maximum = Math.max(maximum, ++active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return { data: page };
    });
    await Promise.all([
      provider.extract(imagePath),
      provider.extract(imagePath),
    ]);
    expect(maximum).toBe(1);
    expect(worker.recognize).toHaveBeenCalledTimes(4);
  });

  it('reconstructs separate OCR blocks in visual left-to-right order', () => {
    const word = (text: string, x: number, y: number) => ({
      text,
      confidence: 95,
      bbox: { x0: x, y0: y, x1: x + 30, y1: y + 40 },
    });
    const words = [
      word('1', 500, 200),
      word('Alpha', 50, 100),
      word('2', 300, 200),
      word('Beta', 500, 100),
    ];
    const data = {
      ...page,
      blocks: words.map((word) => ({
        paragraphs: [{ lines: [{ words: [word] }] }],
      })),
    } as unknown as Page;
    expect(visualRows(data).map((line) => line.text)).toEqual([
      'Alpha Beta',
      '2 1',
    ]);
  });
});

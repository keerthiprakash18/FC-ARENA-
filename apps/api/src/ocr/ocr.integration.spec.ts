import { mkdtemp, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { TesseractOcrProvider } from './providers/tesseract-ocr.provider.js';
import { parseOcrResult } from './ocr-parser.js';

// Explicit opt-in: the real engine may need to download its English trained data.
describe.runIf(process.env.FC_OCR_INTEGRATION === '1')(
  'real Tesseract scoreboard integration',
  () => {
    it.each([false, true])(
      'reads a dark scoreboard with reversed sides = %s',
      async (reversed) => {
        const directory = await mkdtemp(join(tmpdir(), 'fc-ocr-integration-'));
        const imagePath = join(directory, 'scoreboard.png');
        const provider = new TesseractOcrProvider();
        try {
          await sharp(
            Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
        <rect width="1600" height="900" fill="#101820"/>
        <g fill="white" font-family="Arial, sans-serif" text-anchor="middle">
          <text x="1400" y="70" font-size="32">12:10</text>
          <text x="400" y="230" font-size="54">${reversed ? 'Beta' : 'Alpha'}</text>
          <text x="1200" y="230" font-size="54">${reversed ? 'Alpha' : 'Beta'}</text>
          <text x="650" y="390" font-size="96">3</text><text x="800" y="390" font-size="96">-</text><text x="950" y="390" font-size="96">1</text>
          <text x="800" y="600" font-size="32">Shots 12-10</text>
        </g></svg>`),
          )
            .png()
            .toFile(imagePath);
          const raw = await provider.extract(imagePath);
          const parsed = parseOcrResult(
            raw,
            [
              {
                userId: 'alpha',
                fullName: 'Alpha Player',
                inGameName: 'Alpha',
              },
            ],
            [{ userId: 'beta', fullName: 'Beta Player', inGameName: 'Beta' }],
          );
          expect(parsed.score, JSON.stringify(raw)).toMatchObject({
            homeScore: reversed ? 1 : 3,
            awayScore: reversed ? 3 : 1,
          });
          expect(parsed.score.confidence).toBeGreaterThanOrEqual(0.5);
        } finally {
          await provider.onModuleDestroy();
          await unlink(imagePath).catch(() => undefined);
          await rmdir(directory);
        }
      },
      90_000,
    );
  },
);

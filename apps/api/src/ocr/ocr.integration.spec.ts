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
    it.each([[0, 0], [1, 0], [10, 2]])(
      'reads FC Mobile header goals %s-%s around a decorative centre emblem',
      async (homeScore, awayScore) => {
        const directory = await mkdtemp(join(tmpdir(), 'fc-ocr-header-'));
        const imagePath = join(directory, 'header.png');
        const provider = new TesseractOcrProvider();
        try {
          await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2340" height="1080">
            <rect width="2340" height="1080" fill="#101820"/>
            <g fill="white" font-family="Arial, sans-serif" text-anchor="middle">
              <text x="500" y="205" font-size="48">Alpha</text>
              <text x="1840" y="205" font-size="48">Beta</text>
              <text x="1025" y="225" font-size="96">${homeScore}</text>
              <text x="1315" y="225" font-size="96">${awayScore}</text>
              <text x="1170" y="245" font-size="130">7</text>
              <text x="1170" y="272" font-size="32">90:00</text>
              <text x="1170" y="500" font-size="32">Shots 12-10</text>
            </g></svg>`)).png().toFile(imagePath);
          const parsed = parseOcrResult(await provider.extract(imagePath),
            [{ userId: 'alpha', fullName: 'Alpha Player', inGameName: 'Alpha' }],
            [{ userId: 'beta', fullName: 'Beta Player', inGameName: 'Beta' }]);
          expect(parsed.score).toMatchObject({ homeScore, awayScore });
          expect(parsed.score.confidence).toBeGreaterThanOrEqual(0.5);
        } finally {
          await provider.onModuleDestroy();
          await unlink(imagePath).catch(() => undefined);
          await rmdir(directory);
        }
      }, 90_000,
    );
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

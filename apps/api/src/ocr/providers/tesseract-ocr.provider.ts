import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  createWorker,
  PSM,
  type Worker,
  type Page,
  type Word,
} from 'tesseract.js';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  OcrProvider,
  OcrRawExtraction,
  OcrTextLine,
} from '../ocr.types.js';
import { detectScore, normalizedConfidence } from '../ocr-parser.js';

// Sparse-text OCR emits separate blocks for names and digits. Rebuild visual rows
// from word coordinates so widely spaced scoreboard digits remain one row.
export function visualRows(data: Page): OcrTextLine[] {
  const words = (data.blocks ?? [])
    .flatMap((block) =>
      block.paragraphs.flatMap((paragraph) =>
        paragraph.lines.flatMap((line) => line.words),
      ),
    )
    .filter((word) => word.text.trim())
    .sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const rows: Word[][] = [];
  for (const word of words) {
    const center = (word.bbox.y0 + word.bbox.y1) / 2;
    const row = rows.find((items) => {
      const first = items[0];
      return (
        Math.abs(center - (first.bbox.y0 + first.bbox.y1) / 2) <=
        Math.min(word.bbox.y1 - word.bbox.y0, first.bbox.y1 - first.bbox.y0) *
          0.6
      );
    });
    if (row) row.push(word);
    else rows.push([word]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.bbox.x0 - b.bbox.x0);
    let offset = 0;
    return {
      text: row.map((word) => word.text).join(' '),
      words: row.map((word) => {
        const positioned = {
          text: word.text,
          offset,
          confidence: normalizedConfidence(word.confidence / 100),
          bbox: word.bbox,
        };
        offset += word.text.length + 1;
        return positioned;
      }),
      confidence: normalizedConfidence(
        Math.min(...row.map((word) => word.confidence)) / 100,
      ),
      bbox: {
        x0: Math.min(...row.map((word) => word.bbox.x0)),
        y0: Math.min(...row.map((word) => word.bbox.y0)),
        x1: Math.max(...row.map((word) => word.bbox.x1)),
        y1: Math.max(...row.map((word) => word.bbox.y1)),
      },
    };
  });
}

// FC Mobile's final-result header places each goal total beside a decorative
// centre emblem. Reading the entire row can turn that emblem into a third digit.
// Anchor the two small crops to the full-time clock, excluding the emblem.
export function scoreboardRegions(lines: OcrTextLine[], width: number, height: number) {
  const clock = lines.find((line) =>
    /^(?:90|120)\s*[:.]\s*00$/.test(line.text.trim()) && line.bbox &&
    line.bbox.y0 < height * 0.45 &&
    Math.abs((line.bbox.x0 + line.bbox.x1) / 2 - width / 2) < width * 0.08,
  );
  if (!clock?.bbox || width < height * 1.4) return [];
  const clockHeight = clock.bbox.y1 - clock.bbox.y0;
  if (clockHeight < 8 || clockHeight > height * 0.08) return [];
  const top = Math.max(0, Math.floor(clock.bbox.y0 - clockHeight * 4.5));
  const bottom = Math.min(height, Math.floor(clock.bbox.y0 - clockHeight * 0.1));
  const center = (clock.bbox.x0 + clock.bbox.x1) / 2;
  return [-0.1, 0.025].map((relativeLeft) => ({
    left: Math.max(0, Math.floor(center + width * relativeLeft)),
    top,
    width: Math.floor(width * 0.075),
    height: bottom - top,
  }));
}

export function scoreboardDigit(data: Page) {
  const text = data.text.trim();
  // Confusable glyphs are converted only inside an isolated score crop. Never
  // rewrite letters in names, clocks, or the full-page OCR text.
  if (!/^[\dOoIl|]{1,2}$/.test(text)) return null;
  const score = Number(text.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1'));
  if (score > 30) return null;
  return { score, confidence: normalizedConfidence(Number(data.confidence) / 100) };
}

// Some layouts omit every isolated score digit from both OCR page passes.
// Locate a large text band in the actual pixels, then let OCR read it again;
// never infer the numbers from clocks, statistics or participant names.
export function largestTextBand(pixels: Buffer, width: number, height: number) {
  const bands: { top: number; bottom: number }[] = [];
  let start = -1, lastInk = -1;
  const left = Math.floor(width * 0.05), right = Math.ceil(width * 0.95);
  for (let y = 0; y < height; y++) {
    let ink = 0;
    for (let x = left; x < right; x++) if (pixels[y * width + x] < 128) ink++;
    if (ink >= Math.max(3, width * 0.003) && ink < width * 0.35) {
      if (start < 0) start = y;
      lastInk = y;
    } else if (start >= 0 && y - lastInk > 3) {
      bands.push({ top: start, bottom: lastInk + 1 }); start = -1;
    }
  }
  if (start >= 0) bands.push({ top: start, bottom: lastInk + 1 });
  return bands.filter(band => band.bottom - band.top >= 14 && band.bottom - band.top <= height * 0.2)
    .sort((a,b) => (b.bottom-b.top)-(a.bottom-a.top))[0] ?? null;
}

@Injectable()
export class TesseractOcrProvider implements OcrProvider, OnModuleDestroy {
  private workerPromise: Promise<Worker> | null = null;
  private pending: Promise<void> = Promise.resolve();

  private getWorker() {
    if (!this.workerPromise) {
      const cachePath = resolve(
        process.cwd(),
        process.env.OCR_CACHE_DIR ?? 'storage/ocr-cache',
      );
      this.workerPromise = mkdir(cachePath, { recursive: true })
        .then(() => createWorker('eng', undefined, {
          cachePath,
          // Tesseract otherwise throws from its message handler in addition to
          // rejecting the job, which bypasses BullMQ's retry/error handling.
          errorHandler: () => undefined,
        }))
        .catch((error) => {
          this.workerPromise = null;
          throw error;
        });
    }
    return this.workerPromise;
  }

  extract(imagePath: string): Promise<OcrRawExtraction> {
    const extraction = this.pending.then(() => this.recognize(imagePath));
    this.pending = extraction.then(
      () => undefined,
      () => undefined,
    );
    return extraction;
  }

  private async recognize(imagePath: string): Promise<OcrRawExtraction> {
    const metadata = await sharp(imagePath).metadata();
    const resized = await sharp(imagePath)
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({
        width: Math.min(2400, Math.max(1600, metadata.width ?? 1600)),
        height: 2400,
        fit: 'inside',
      })
      .png()
      .toBuffer();
    const prepared = await sharp(resized).grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer();
    const statistics = await sharp(prepared).stats();
    const image =
      statistics.channels[0].mean < 127
        ? await sharp(prepared).negate({ alpha: false }).png().toBuffer()
        : prepared;
    const worker = await this.getWorker();
    try {
      const variants: OcrRawExtraction[] = [];
      for (const mode of [PSM.SPARSE_TEXT, PSM.AUTO]) {
        await worker.setParameters({
          tessedit_pageseg_mode: mode,
          preserve_interword_spaces: '1',
          tessedit_char_whitelist: '',
        });
        const { data } = await worker.recognize(
          image,
          {},
          { text: true, blocks: true },
        );
        const lines = visualRows(data);
        variants.push({
          text: lines.length
            ? lines.map((line) => line.text).join('\n')
            : (data.text ?? ''),
          confidence: normalizedConfidence(Number(data.confidence) / 100),
          lines,
        });
      }
      const dimensions = await sharp(image).metadata();
      const regions = scoreboardRegions(
        variants.flatMap((variant) => variant.lines ?? []),
        dimensions.width!,
        dimensions.height!,
      );
      const digits: Array<{ score: number; confidence: number }> = [];
      for (const region of regions) {
        // Normalize each goal region independently. Full-page sharpening can
        // erase a thin round zero against the header's gradient background.
        let crop = await sharp(resized).extract(region).grayscale().normalize().png().toBuffer();
        if ((await sharp(crop).stats()).channels[0].mean < 127) {
          crop = await sharp(crop).negate({ alpha: false }).png().toBuffer();
        }
        crop = await sharp(crop).resize({ height: 240 })
          .extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#ffffff' })
          .png().toBuffer();
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_LINE,
          tessedit_char_whitelist: '',
        });
        const { data } = await worker.recognize(crop, {}, { text: true, blocks: true });
        let digit = scoreboardDigit(data);
        if (!digit) {
          // A lone round zero is sometimes classified as a graphic by the line
          // segmenter. Try word segmentation in this isolated goal region.
          await worker.setParameters({
            tessedit_pageseg_mode: PSM.SINGLE_WORD,
            tessedit_char_whitelist: '',
          });
          const retried = await worker.recognize(crop, {}, { text: true, blocks: true });
          digit = scoreboardDigit(retried.data);
        }
        if (!digit) break;
        digits.push(digit);
      }
      if (digits.length === 2) {
        const scoreLine: OcrTextLine = {
          text: `${digits[0].score} - ${digits[1].score}`,
          confidence: Math.min(digits[0].confidence, digits[1].confidence),
          source: 'scoreboard',
          bbox: {
            x0: regions[0].left,
            x1: regions[1].left + regions[1].width,
            y0: regions[0].top,
            y1: regions[0].top + regions[0].height,
          },
        };
        const recoveredVariants = variants.map((variant) => {
          const lines = [...(variant.lines ?? []), scoreLine]
            .sort((a, b) => (a.bbox?.y0 ?? 0) - (b.bbox?.y0 ?? 0));
          return { ...variant, lines, text: lines.map((line) => line.text).join('\n') };
        });
        variants.push(...recoveredVariants);
      }
      if (
        digits.length !== 2 &&
        !variants.some(
          (variant) =>
            detectScore(variant.lines ?? [], variant.confidence).confidence >=
            0.5,
        )
      ) {
        // Large, isolated scoreboard digits are often discarded as graphics by
        // page segmentation. Retry their visual band as a single numeric line.
        let numericLine = variants
          .flatMap((variant) => variant.lines ?? [])
          .filter((line) => /^\d{1,2}$/.test(line.text.trim()) && line.bbox)
          .sort(
            (a, b) => b.bbox!.y1 - b.bbox!.y0 - (a.bbox!.y1 - a.bbox!.y0),
          )[0];
        if (!numericLine) {
          const { data: pixels, info } = await sharp(image).greyscale().removeAlpha().raw().toBuffer({ resolveWithObject: true });
          const band = largestTextBand(pixels, info.width, info.height);
          if (band) numericLine = { text: '', confidence: 0,
            bbox: { x0: 0, x1: info.width, y0: band.top, y1: band.bottom } };
        }
        if (numericLine?.bbox) {
          const dimensions = await sharp(image).metadata();
          const padding = Math.ceil(
            (numericLine.bbox.y1 - numericLine.bbox.y0) * 0.5,
          );
          const top = Math.max(0, numericLine.bbox.y0 - padding);
          const bottom = Math.min(
            dimensions.height!,
            numericLine.bbox.y1 + padding,
          );
          const cropped = await sharp(image)
            .extract({
              left: 0,
              top,
              width: dimensions.width!,
              height: bottom - top,
            })
            .png()
            .toBuffer();
          const band = await sharp(cropped)
            .trim({ background: '#ffffff', threshold: 10 })
            .extend({
              top: 20,
              bottom: 20,
              left: 20,
              right: 20,
              background: '#ffffff',
            })
            .png()
            .toBuffer();
          await worker.setParameters({
            tessedit_pageseg_mode: PSM.SINGLE_LINE,
            tessedit_char_whitelist: '',
          });
          const { data } = await worker.recognize(
            band,
            {},
            { text: true, blocks: true },
          );
          const recovered = visualRows(data).map((line) => ({
            ...line,
            bbox: {
              x0: 0,
              x1: dimensions.width!,
              y0: numericLine.bbox!.y0,
              y1: numericLine.bbox!.y1,
            },
          }));
          const lines = [...(variants[0].lines ?? []), ...recovered].sort(
            (a, b) => (a.bbox?.y0 ?? 0) - (b.bbox?.y0 ?? 0),
          );
          if (recovered.length)
            variants.push({
              text: lines.map((line) => line.text).join('\n'),
              lines,
              confidence: normalizedConfidence(Number(data.confidence) / 100),
            });
        }
      }
      return { ...variants[0], alternatives: variants.slice(1) };
    } catch (error) {
      this.workerPromise = null;
      await worker.terminate().catch(() => undefined);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.pending;
    const pending = this.workerPromise;
    this.workerPromise = null;
    if (pending)
      await pending.then((worker) => worker.terminate()).catch(() => undefined);
  }
}

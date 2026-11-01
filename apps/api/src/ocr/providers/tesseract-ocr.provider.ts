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
    return {
      text: row.map((word) => word.text).join(' '),
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
        .then(() => createWorker('eng', undefined, { cachePath }))
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
    const prepared = await sharp(imagePath)
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({
        width: Math.min(2400, Math.max(1600, metadata.width ?? 1600)),
        height: 2400,
        fit: 'inside',
      })
      .grayscale()
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
      if (
        !variants.some(
          (variant) =>
            detectScore(variant.lines ?? [], variant.confidence).confidence >=
            0.5,
        )
      ) {
        // Large, isolated scoreboard digits are often discarded as graphics by
        // page segmentation. Retry their visual band as a single numeric line.
        const numericLine = variants
          .flatMap((variant) => variant.lines ?? [])
          .filter((line) => /^\d{1,2}$/.test(line.text.trim()) && line.bbox)
          .sort(
            (a, b) => b.bbox!.y1 - b.bbox!.y0 - (a.bbox!.y1 - a.bbox!.y0),
          )[0];
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

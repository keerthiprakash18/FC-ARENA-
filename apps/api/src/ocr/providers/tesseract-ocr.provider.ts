import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  createWorker,
  type Worker,
} from 'tesseract.js';
import type {
  OcrProvider,
  OcrRawExtraction,
} from '../ocr.types.js';

@Injectable()
export class TesseractOcrProvider
  implements
    OcrProvider,
    OnModuleDestroy
{
  private workerPromise:
    Promise<Worker> | null = null;

  private getWorker() {
    if (!this.workerPromise) {
      this.workerPromise =
        createWorker('eng');
    }

    return this.workerPromise;
  }

  async extract(
    imagePath: string,
  ): Promise<OcrRawExtraction> {
    const worker =
      await this.getWorker();

    const result =
      await worker.recognize(
        imagePath,
      );

    return {
      text:
        result.data.text ?? '',

      confidence:
        Math.max(
          0,
          Math.min(
            1,
            Number(
              result.data.confidence ??
                0,
            ) / 100,
          ),
        ),
    };
  }

  async onModuleDestroy() {
    if (!this.workerPromise) {
      return;
    }

    try {
      const worker =
        await this.workerPromise;

      await worker.terminate();
    } finally {
      this.workerPromise =
        null;
    }
  }
}
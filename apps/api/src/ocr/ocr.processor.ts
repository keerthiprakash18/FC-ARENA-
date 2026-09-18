import {
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import type {
  Job,
} from 'bullmq';
import {
  OCR_JOB_PROCESS_MATCH_RESULT,
  OCR_QUEUE,
} from './ocr.constants.js';
import type {
  OcrJobData,
} from './ocr.types.js';
import { OcrService } from './ocr.service.js';

@Processor(
  OCR_QUEUE,
  {
    concurrency: 1,
  },
)
export class OcrProcessor
  extends WorkerHost
{
  constructor(
    private readonly ocrService:
      OcrService,
  ) {
    super();
  }

  async process(
    job: Job<OcrJobData>,
  ) {
    if (
      job.name !==
      OCR_JOB_PROCESS_MATCH_RESULT
    ) {
      return;
    }

    return this.ocrService.processExtraction(
      job.data
        .ocrExtractionId,
    );
  }
}
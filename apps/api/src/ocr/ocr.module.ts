import { Module } from '@nestjs/common';
import {
  BullModule,
} from '@nestjs/bullmq';
import {
  AuthModule,
} from '../auth/auth.module.js';
import {
  OCR_QUEUE,
} from './ocr.constants.js';
import {
  OcrController,
} from './ocr.controller.js';
import {
  OcrProcessor,
} from './ocr.processor.js';
import {
  OcrService,
} from './ocr.service.js';
import {
  TesseractOcrProvider,
} from './providers/tesseract-ocr.provider.js';

@Module({
  imports: [
    AuthModule,

    BullModule.registerQueue({
      name:
        OCR_QUEUE,

      connection: {
        host:
          process.env
            .REDIS_HOST ??
          '127.0.0.1',

        port:
          Number(
            process.env
              .REDIS_PORT ??
              6379,
          ),
      },
    }),
  ],

  controllers: [
    OcrController,
  ],

  providers: [
    OcrService,
    OcrProcessor,
    TesseractOcrProvider,
  ],

  exports: [
    OcrService,
  ],
})
export class OcrModule {}
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

function getRedisConnection() {
  const redisUrl =
    process.env.REDIS_URL;

  if (redisUrl) {
    const url =
      new URL(redisUrl);

    return {
      host:
        url.hostname,

      port:
        Number(
          url.port ||
            6379,
        ),

      username:
        url.username
          ? decodeURIComponent(
              url.username,
            )
          : undefined,

      password:
        url.password
          ? decodeURIComponent(
              url.password,
            )
          : undefined,

      family:
        0 as const,
    };
  }

  return {
    host:
      process.env.REDIS_HOST ??
      '127.0.0.1',

    port:
      Number(
        process.env.REDIS_PORT ??
          6379,
      ),

    username:
      process.env.REDIS_USERNAME ||
      undefined,

    password:
      process.env.REDIS_PASSWORD ||
      undefined,

    family:
      0 as const,
  };
}

@Module({
  imports: [
    AuthModule,

    BullModule.registerQueue({
      name:
        OCR_QUEUE,

      connection:
        getRedisConnection(),
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
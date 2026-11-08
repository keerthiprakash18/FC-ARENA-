import { ServiceUnavailableException } from '@nestjs/common';

const publicMessages = {
  OCR_STORAGE_UNAVAILABLE: 'Screenshot storage is temporarily unavailable. Please retry shortly or enter the scores manually.',
  OCR_QUEUE_UNAVAILABLE: 'Screenshot processing is temporarily unavailable. Please retry shortly or enter the scores manually.',
} as const;

// Only these fixed messages may pass through the internal-error masking filter.
// Never accept an upstream exception, path, provider response or arbitrary text.
export class PublicServiceUnavailableException extends ServiceUnavailableException {
  constructor(code: keyof typeof publicMessages) {
    super({ success: false, data: null, error: { code, message: publicMessages[code] } });
    this.message = publicMessages[code];
  }
}

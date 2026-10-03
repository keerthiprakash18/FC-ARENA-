import { describe, expect, it } from 'vitest';
import { assertImageFormat } from './image-format.js';

describe('Uploaded image format validation', () => {
  it.each([['image/jpeg', 'jpeg'], ['image/png', 'png'], ['image/webp', 'webp']])('accepts matching %s bytes', (mime, format) => {
    expect(() => assertImageFormat(mime, format)).not.toThrow();
  });
  it.each([['image/png', 'svg'], ['image/jpeg', 'png'], ['image/png', 'gif'], ['application/octet-stream', 'jpeg'], ['image/png', undefined]])('rejects spoofed or unsupported %s/%s', (mime, format) => {
    expect(() => assertImageFormat(mime as string, format)).toThrow();
  });
});

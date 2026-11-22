import { BadRequestException } from '@nestjs/common';

/** Account contact stays private; this does not enable public WhatsApp sharing. */
export function normalizeWhatsAppNumber(value: unknown): string {
  if (typeof value !== 'string' || !/^[+\d\s().-]{8,32}$/.test(value))
    return invalid();
  let number = value.replace(/[\s().-]/g, '');
  if (/^[6-9]\d{9}$/.test(number)) number = '+91' + number;
  if (!/^\+[1-9]\d{7,14}$/.test(number)) return invalid();
  return number;
}
function invalid(): never {
  throw new BadRequestException({
    success: false,
    data: null,
    error: {
      code: 'INVALID_WHATSAPP_NUMBER',
      message:
        'Enter your WhatsApp number with country code, for example +91 98765 43210.',
    },
  });
}
export function phoneAliases(number: string) {
  return [
    ...new Set([
      number,
      number.slice(1),
      ...(/^\+91[6-9]\d{9}$/.test(number) ? [number.slice(3)] : []),
    ]),
  ];
}

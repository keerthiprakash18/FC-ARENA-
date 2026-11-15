import { BadRequestException } from '@nestjs/common';

/**
 * WhatsApp click-to-chat requires a complete international E.164 number.
 * Do not infer a country code from account location, saved login numbers or locale.
 */
export function normalizeWhatsAppNumber(input: string | null | undefined): string | null | undefined {
  if (input === undefined || input === null) return input;
  const value = input.trim().replace(/[\s()\-]/g, '');
  if (!value) return null;
  if (!/^\+[1-9]\d{7,14}$/.test(value)) {
    throw new BadRequestException(
      'Enter a WhatsApp number with its country code, for example +919876543210.',
    );
  }
  return value;
}

export function isOpposingFixtureMember(
  viewerId: string,
  targetId: string,
  homePlayers: readonly string[],
  awayPlayers: readonly string[],
): boolean {
  if (viewerId === targetId) return false;
  return (homePlayers.includes(viewerId) && awayPlayers.includes(targetId))
    || (awayPlayers.includes(viewerId) && homePlayers.includes(targetId));
}

export function whatsappContactUrl(number: string): string {
  // This only accepts previously normalized E.164 numbers.
  if (!/^\+[1-9]\d{7,14}$/.test(number)) {
    throw new BadRequestException('WhatsApp contact number is invalid.');
  }
  return 'https://wa.me/' + number.slice(1);
}

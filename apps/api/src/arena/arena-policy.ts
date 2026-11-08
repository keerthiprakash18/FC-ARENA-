import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

export function normalizeSourceUrl(
  source: string | undefined,
  required: boolean,
): string | null {
  if (!source?.trim()) {
    if (required)
      throw new BadRequestException('Add a source link for a news post.');
    return null;
  }
  try {
    const url = new URL(source.trim());
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !url.hostname.includes('.')
    )
      throw new Error();
    return url.toString();
  } catch {
    throw new BadRequestException('Use a valid HTTPS source link.');
  }
}

export function normalizePoll(options?: string[]) {
  if (!options) return [];
  const normalized = options.map((option) => option.trim());
  if (
    normalized.length < 2 ||
    normalized.length > 4 ||
    normalized.some((option) => !option || option.length > 100) ||
    new Set(normalized.map((option) => option.toLocaleLowerCase())).size !==
      normalized.length
  ) {
    throw new BadRequestException(
      'Add two to four different poll options, up to 100 characters each.',
    );
  }
  return normalized;
}

export function encodeArenaCursor(row: { id: string; createdAt: Date }) {
  return Buffer.from(
    JSON.stringify({ id: row.id, at: row.createdAt.toISOString() }),
  ).toString('base64url');
}
export function decodeArenaCursor(value?: string) {
  if (!value) return undefined;
  try {
    if (value.length > 200 || !/^[\w-]+$/.test(value)) throw new Error();
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString()) as {
      id?: unknown;
      at?: unknown;
    };
    if (
      typeof cursor.id !== 'string' ||
      !isUUID(cursor.id) ||
      typeof cursor.at !== 'string'
    )
      throw new Error();
    const createdAt = new Date(cursor.at);
    if (
      !Number.isFinite(createdAt.getTime()) ||
      createdAt.toISOString() !== cursor.at
    )
      throw new Error();
    return { id: cursor.id, createdAt };
  } catch {
    throw new BadRequestException(
      'This feed position is invalid. Refresh and try again.',
    );
  }
}

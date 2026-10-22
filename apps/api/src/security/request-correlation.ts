import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function resolveRequestId(value: string | undefined): string {
  const candidate = value?.trim();

  return candidate && REQUEST_ID_PATTERN.test(candidate)
    ? candidate
    : randomUUID();
}

export function requestCorrelationMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(request.get(REQUEST_ID_HEADER));

  response.locals.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

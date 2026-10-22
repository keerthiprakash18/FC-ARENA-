import { describe, expect, it, vi } from 'vitest';
import {
  requestCorrelationMiddleware,
  REQUEST_ID_HEADER,
} from './request-correlation.js';

describe('request correlation', () => {
  it('preserves a valid incoming request ID and exposes it on the response', () => {
    const response = {
      locals: {},
      setHeader: vi.fn(),
    };
    const next = vi.fn();

    requestCorrelationMiddleware(
      { get: vi.fn().mockReturnValue('edge-req-123') } as never,
      response as never,
      next,
    );

    expect(response.locals).toEqual({ requestId: 'edge-req-123' });
    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'edge-req-123');
    expect(next).toHaveBeenCalledOnce();
  });

  it('replaces invalid request IDs with a generated opaque ID', () => {
    const locals: { requestId?: string } = {};
    const response = {
      locals,
      setHeader: vi.fn(),
    };

    requestCorrelationMiddleware(
      { get: vi.fn().mockReturnValue('untrusted\nvalue') } as never,
      response as never,
      vi.fn(),
    );

    expect(response.locals.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.locals.requestId).not.toContain('untrusted');
  });
});

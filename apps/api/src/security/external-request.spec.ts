import { describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, getExternalRequestTimeoutMs } from './external-request.js';

describe('external request bounds', () => {
  it('clamps configured timeouts to safe bounds', () => {
    process.env.EXTERNAL_REQUEST_TIMEOUT_MS = '100';
    expect(getExternalRequestTimeoutMs()).toBe(1_000);

    process.env.EXTERNAL_REQUEST_TIMEOUT_MS = '999999';
    expect(getExternalRequestTimeoutMs()).toBe(60_000);

    delete process.env.EXTERNAL_REQUEST_TIMEOUT_MS;
  });

  it('aborts a request when the bounded timeout expires', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      }),
    );

    await expect(fetchWithTimeout('https://example.test', {}, 1_000)).rejects.toThrow(
      'External request timed out.',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    fetchMock.mockRestore();
  });

  it('propagates a caller abort and clears the request timer', async () => {
    vi.useFakeTimers();
    const caller = new AbortController();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      }),
    );

    const pending = fetchWithTimeout('https://example.test', { signal: caller.signal }, 5_000);
    caller.abort(new Error('caller stopped request'));
    await expect(pending).rejects.toThrow('caller stopped request');
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockRestore();
    vi.useRealTimers();
  });
});

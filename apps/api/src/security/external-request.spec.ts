import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, getExternalRequestTimeoutMs } from './external-request.js';

describe('external request bounds', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
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

  it('bounds a stalled body after HTTP headers and cancels the upstream reader', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('{')); }, cancel,
    })));
    const pending = fetchWithTimeout('https://stalled-body.test', {}, 1000);
    const rejected = expect(pending).rejects.toThrow('External request timed out.');
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves JSON/status/headers and rejects unbounded provider responses', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{"ok":true}', {
      status: 201, headers: { 'content-type': 'application/json', 'x-provider-id': '123' },
    }));
    const response = await fetchWithTimeout('https://payload.test');
    expect(response.status).toBe(201);
    expect(response.headers.get('x-provider-id')).toBe('123');
    await expect(response.json()).resolves.toEqual({ ok: true });
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array(2 * 1024 * 1024 + 1)));
    await expect(fetchWithTimeout('https://oversize.test')).rejects.toThrow('size limit');
  });

  it('fails fast after repeated 503 responses without retrying writes or blocking other providers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 503 }));
    for (let i = 0; i < 5; i++) await fetchWithTimeout('https://outage.test', { method: 'POST', body: '{}' });
    await expect(fetchWithTimeout('https://outage.test')).rejects.toThrow('temporarily unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(5);
    await fetchWithTimeout('https://unrelated-provider.test');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('does not open circuits for client errors or pre-cancelled caller Requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 400 }));
    for (let i = 0; i < 6; i++) await fetchWithTimeout('https://client-error.test');
    const controller = new AbortController(); controller.abort(new Error('cancelled request'));
    const input = new Request('https://client-error.test', { signal: controller.signal });
    await expect(fetchWithTimeout(input)).rejects.toThrow('cancelled request');
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});

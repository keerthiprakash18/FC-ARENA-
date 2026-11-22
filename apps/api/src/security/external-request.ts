import { ExternalCircuitBreaker } from './external-circuit.js';

const DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS = 15_000;
const MIN_EXTERNAL_REQUEST_TIMEOUT_MS = 1_000;
const MAX_EXTERNAL_REQUEST_TIMEOUT_MS = 60_000;
const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;
const circuits = new ExternalCircuitBreaker();

export function getExternalRequestTimeoutMs(
  fallback = DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS,
): number {
  const configured = Number.parseInt(
    process.env.EXTERNAL_REQUEST_TIMEOUT_MS ?? '',
    10,
  );

  const value = Number.isFinite(configured) ? configured : fallback;

  return Math.min(
    MAX_EXTERNAL_REQUEST_TIMEOUT_MS,
    Math.max(MIN_EXTERNAL_REQUEST_TIMEOUT_MS, value),
  );
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = getExternalRequestTimeoutMs(),
): Promise<Response> {
  const callerSignal = init.signal ?? (input instanceof Request ? input.signal : undefined);
  callerSignal?.throwIfAborted();
  const url = new URL(input instanceof Request ? input.url : input);
  const permit = circuits.acquire(url.origin);
  const controller = new AbortController();
  let rejectAborted!: (reason: unknown) => void;
  const aborted = new Promise<never>((_resolve, reject) => { rejectAborted = reject; });
  const abort = (reason: unknown) => {
    controller.abort(reason);
    rejectAborted(reason);
  };
  const timeout = setTimeout(
    () => abort(new Error('External request timed out.')),
    Math.min(
      MAX_EXTERNAL_REQUEST_TIMEOUT_MS,
      Math.max(MIN_EXTERNAL_REQUEST_TIMEOUT_MS, timeoutMs),
    ),
  );

  const abortFromCaller = () => abort(callerSignal?.reason);
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await Promise.race([aborted, (async () => {
      const upstream = await fetch(input, { ...init, signal: controller.signal });
      controller.signal.throwIfAborted();
      if (!upstream.body) return upstream;
      // These providers return small JSON payloads. Consume under the same
      // deadline: fetch() alone resolves at headers, before json()/text().
      const reader = upstream.body.getReader();
      const cancelBody = () => { void reader.cancel().catch(() => undefined); };
      controller.signal.addEventListener('abort', cancelBody, { once: true });
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_PROVIDER_RESPONSE_BYTES) {
            controller.abort(new Error('External response exceeded the size limit.'));
            throw new Error('External response exceeded the size limit.');
          }
          chunks.push(value);
        }
      } finally {
        controller.signal.removeEventListener('abort', cancelBody);
        reader.releaseLock();
      }
      const body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      const buffered = new Response(body, {
        status: upstream.status, statusText: upstream.statusText, headers: upstream.headers,
      });
      for (const key of ['url', 'redirected', 'type'] as const) {
        Object.defineProperty(buffered, key, { value: upstream[key] });
      }
      return buffered;
    })()]);
    circuits.complete(permit, response.status >= 500 ? 'failure' : 'success');
    return response;
  } catch (error) {
    circuits.complete(permit, callerSignal?.aborted ? 'cancelled' : 'failure');
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }
}

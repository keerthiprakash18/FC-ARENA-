const PRODUCTION_API_URL =
  'https://api.fcarena.in/api';

const configuredApiUrl =
  process.env.NEXT_PUBLIC_API_URL?.trim();

// Browser requests share the website connection. This also covers uploads and
// event streams that use API_URL directly, avoiding a second DNS/TLS/CORS path.
export const API_URL = typeof window !== 'undefined'
  ? '/api'
  : configuredApiUrl || (process.env.NODE_ENV === 'production'
    ? PRODUCTION_API_URL : 'http://localhost:4000/api');

const DEFAULT_TIMEOUT_MS = 15_000;
const READ_HANDSHAKE_TIMEOUT_MS = 6_000;
const SAFE_RETRY_DELAY_MS = 250;
const RETRYABLE_STATUSES = new Set([408, 502, 503, 504]);

function resolveApiUrl(path: string): string {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface ApiFailure {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    details?: string[];
  };
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: string[];

  constructor(input: {
    code: string;
    message: string;
    status: number;
    details?: string[];
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
  }
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('Request cancelled.', 'AbortError');
}

function wait(milliseconds: number, signal?: AbortSignal | null): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortReason(signal));
  return new Promise((resolve, reject) => {
    const finish = () => { signal?.removeEventListener('abort', cancel); resolve(); };
    const timer = setTimeout(finish, milliseconds);
    const cancel = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      reject(abortReason(signal!));
    };
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  handshakeTimeoutMs = timeoutMs,
): Promise<{ response: Response; payload: unknown }> {
  const upstream = options.signal;
  if (upstream?.aborted) throw abortReason(upstream);
  const controller = new AbortController();
  let rejectCancellation: (reason: unknown) => void = () => {};
  const cancelled = new Promise<never>((_, reject) => { rejectCancellation = reject; });
  const cancel = () => {
    const reason = abortReason(upstream!);
    rejectCancellation(reason);
    controller.abort(reason);
  };
  const timedOut = () => {
    const reason = new ApiError({ code: 'REQUEST_TIMEOUT',
      message: 'FC ARENA is taking longer than expected. Please retry shortly.', status: 408 });
    rejectCancellation(reason);
    controller.abort(reason);
  };
  const timer = setTimeout(timedOut, timeoutMs);
  const handshakeTimer = setTimeout(timedOut, Math.min(timeoutMs, handshakeTimeoutMs));
  upstream?.addEventListener('abort', cancel, { once: true });

  try {
    return await Promise.race([cancelled, (async () => {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(handshakeTimer);
      let payload: unknown = null;
      if (response.status !== 204 && options.method !== 'HEAD') {
        try { payload = await response.json(); }
        catch (error) {
          if (controller.signal.aborted) throw error;
          if (response.ok) throw new ApiError({ code: 'INVALID_RESPONSE',
            message: 'FC ARENA returned an incomplete response. Please retry.', status: 502 });
        }
      }
      return { response, payload };
    })()]);
  } catch (error) {
    if (upstream?.aborted) throw abortReason(upstream);
    if (error instanceof ApiError) throw error;
    throw new ApiError({ code: 'NETWORK_UNAVAILABLE',
      message: 'FC ARENA is temporarily unreachable. Please retry shortly.', status: 0 });
  } finally {
    clearTimeout(timer);
    clearTimeout(handshakeTimer);
    upstream?.removeEventListener('abort', cancel);
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (options.signal?.aborted) throw abortReason(options.signal);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError({ code: 'NETWORK_OFFLINE',
      message: 'You are offline. Reconnect to the internet and retry.', status: 0 });
  }
  const method = (options.method ?? 'GET').toUpperCase();
  const safeToRetry = method === 'GET' || method === 'HEAD';
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
  const headers = new Headers(options.headers);
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  for (let attempt = 0; ; attempt++) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new ApiError({ code: 'NETWORK_OFFLINE',
        message: 'You are offline. Reconnect to the internet and retry.', status: 0 });
    }
    try {
      const { response, payload } = await fetchWithTimeout(resolveApiUrl(path), {
        ...options, method, credentials: 'include', headers,
      }, Math.max(1, deadline - Date.now()), safeToRetry ? READ_HANDSHAKE_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
      if (response.ok) return payload as T;
      const failure = payload as ApiFailure | null;
      throw new ApiError({
        code: failure?.error?.code ?? (response.status >= 500 ? 'SERVICE_UNAVAILABLE' : 'REQUEST_FAILED'),
        message: failure?.error?.message ?? (response.status >= 500
          ? 'FC ARENA is temporarily unavailable. Please retry.'
          : 'Something went wrong. Please try again.'),
        status: response.status, details: failure?.error?.details,
      });
    } catch (error) {
      if (options.signal?.aborted) throw abortReason(options.signal);
      // Reads may retry once within one shared deadline. Mutations never replay.
      if (!safeToRetry || attempt > 0 || !(error instanceof ApiError)
          || (error.status !== 0 && !RETRYABLE_STATUSES.has(error.status))
          || Date.now() + SAFE_RETRY_DELAY_MS >= deadline) throw error;
      await wait(SAFE_RETRY_DELAY_MS, options.signal);
    }
  }
}

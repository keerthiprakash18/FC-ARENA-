const DEFAULT_EXTERNAL_REQUEST_TIMEOUT_MS = 15_000;
const MIN_EXTERNAL_REQUEST_TIMEOUT_MS = 1_000;
const MAX_EXTERNAL_REQUEST_TIMEOUT_MS = 60_000;

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
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error('External request timed out.')),
    Math.min(
      MAX_EXTERNAL_REQUEST_TIMEOUT_MS,
      Math.max(MIN_EXTERNAL_REQUEST_TIMEOUT_MS, timeoutMs),
    ),
  );

  const abortFromCaller = () => controller.abort(init.signal?.reason);

  if (init.signal?.aborted) {
    controller.abort(init.signal.reason);
  } else {
    init.signal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abortFromCaller);
  }
}

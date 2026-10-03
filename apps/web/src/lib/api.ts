const PRODUCTION_API_URL =
  'https://api.fcarena.in/api';

export const API_URL =
  process.env.NODE_ENV ===
  'production'
    ? PRODUCTION_API_URL
    : process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:4000/api';

const DEFAULT_TIMEOUT_MS = 15_000;
const SAFE_RETRY_DELAY_MS = 250;
const RETRYABLE_STATUSES = new Set([
  502,
  503,
  504,
]);

function resolveApiUrl(
  path: string,
): string {
  const normalizedPath =
    path.startsWith('/')
      ? path
      : `/${path}`;

  if (
    typeof window !==
      'undefined' &&
    normalizedPath.startsWith(
      '/auth/',
    )
  ) {
    return `/api${normalizedPath}`;
  }

  return `${API_URL}${normalizedPath}`;
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

function wait(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds,
      ),
  );
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const controller =
    new AbortController();

  const upstreamSignal =
    options.signal;

  const abortFromUpstream =
    () =>
      controller.abort(
        upstreamSignal?.reason,
      );

  if (
    upstreamSignal
      ?.aborted
  ) {
    abortFromUpstream();
  } else {
    upstreamSignal
      ?.addEventListener(
        'abort',
        abortFromUpstream,
        {
          once: true,
        },
      );
  }

  let timedOut =
    false;

  const timer =
    setTimeout(
      () => {
        timedOut =
          true;

        controller.abort(
          new DOMException(
            'Request timed out.',
            'TimeoutError',
          ),
        );
      },
      DEFAULT_TIMEOUT_MS,
    );

  try {
    return await fetch(
      url,
      {
        ...options,
        signal:
          controller.signal,
      },
    );
  } catch (
    error
  ) {
    if (
      upstreamSignal
        ?.aborted
    ) {
      throw error;
    }

    if (
      timedOut
    ) {
      throw new ApiError({
        code:
          'REQUEST_TIMEOUT',
        message:
          'FC ARENA is taking longer than expected. Check your connection and retry.',
        status: 408,
      });
    }

    if (
      error instanceof
        ApiError
    ) {
      throw error;
    }

    throw new ApiError({
      code:
        'NETWORK_UNAVAILABLE',
      message:
        'Unable to reach FC ARENA. Check your internet connection and try again.',
      status: 0,
    });
  } finally {
    clearTimeout(
      timer,
    );

    upstreamSignal
      ?.removeEventListener(
        'abort',
        abortFromUpstream,
      );
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method =
    (
      options.method ??
      'GET'
    ).toUpperCase();

  const safeToRetry =
    method === 'GET' ||
    method === 'HEAD';

  const url =
    resolveApiUrl(
      path,
    );

  const attempts =
    safeToRetry
      ? 2
      : 1;

  for (
    let attempt = 0;
    attempt < attempts;
    attempt++
  ) {
    let response:
      Response;

    try {
      response =
        await fetchWithTimeout(
          url,
          {
            ...options,
            credentials:
              'include',
            headers: {
              'Content-Type':
                'application/json',
              ...(
                options.headers ??
                {}
              ),
            },
          },
        );
    } catch (
      error
    ) {
      if (
        safeToRetry &&
        attempt === 0 &&
        error instanceof
          ApiError &&
        (
          error.status ===
            0 ||
          error.status ===
            408
        )
      ) {
        await wait(
          SAFE_RETRY_DELAY_MS,
        );

        continue;
      }

      throw error;
    }

    const payload =
      await response
        .json()
        .catch(
          () => null,
        );

    if (
      response.ok
    ) {
      return payload as T;
    }

    if (
      safeToRetry &&
      attempt === 0 &&
      RETRYABLE_STATUSES.has(
        response.status,
      )
    ) {
      await wait(
        SAFE_RETRY_DELAY_MS,
      );

      continue;
    }

    throw new ApiError({
      code:
        payload?.error
          ?.code ??
        (
          response.status >=
          500
            ? 'SERVICE_UNAVAILABLE'
            : 'REQUEST_FAILED'
        ),
      message:
        payload?.error
          ?.message ??
        (
          response.status >=
          500
            ? 'FC ARENA is temporarily unavailable. Please retry.'
            : 'Something went wrong. Please try again.'
        ),
      status:
        response.status,
      details:
        payload?.error
          ?.details,
    });
  }

  throw new ApiError({
    code:
      'REQUEST_FAILED',
    message:
      'Something went wrong. Please try again.',
    status: 0,
  });
}

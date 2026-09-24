const PRODUCTION_API_URL =
  'https://api.fcarena.in/api';

export const API_URL =
  process.env.NODE_ENV ===
  'production'
    ? PRODUCTION_API_URL
    : process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:4000/api';


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


export interface ApiRequestOptions
  extends RequestInit {
  timeoutMs?: number;
}


export async function apiRequest<T>(
  path: string,
  options:
    ApiRequestOptions = {},
): Promise<T> {
  const {
    timeoutMs = 15_000,
    signal:
      externalSignal,
    ...requestOptions
  } =
    options;

  const controller =
    new AbortController();

  if (
    externalSignal
      ?.aborted
  ) {
    controller.abort();
  } else {
    externalSignal
      ?.addEventListener(
        'abort',
        () =>
          controller.abort(),
        {
          once: true,
        },
      );
  }

  const timeout =
    globalThis.setTimeout(
      () =>
        controller.abort(),
      timeoutMs,
    );

  try {
    const response =
      await fetch(
        resolveApiUrl(
          path,
        ),
        {
          ...requestOptions,
          signal:
            controller.signal,
          credentials:
            'include',
          headers: {
            'Content-Type':
              'application/json',
            ...(
              requestOptions
                .headers ??
              {}
            ),
          },
        },
      );

    const payload =
      await response
        .json()
        .catch(
          () => null,
        );

    if (
      !response.ok
    ) {
      throw new ApiError({
        code:
          payload?.error
            ?.code ??
          'REQUEST_FAILED',
        message:
          payload?.error
            ?.message ??
          'Something went wrong. Please try again.',
        status:
          response.status,
        details:
          payload?.error
            ?.details,
      });
    }

    return payload as T;
  } catch (
    error
  ) {
    if (
      (
        error as {
          name?: string;
        }
      )?.name ===
      'AbortError'
    ) {
      throw new ApiError({
        code:
          'REQUEST_TIMEOUT',
        message:
          'The server is taking too long to respond. Please try again.',
        status: 408,
      });
    }

    throw error;
  } finally {
    globalThis.clearTimeout(
      timeout,
    );
  }
}

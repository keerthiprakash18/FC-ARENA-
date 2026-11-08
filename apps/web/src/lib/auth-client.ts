import {
  API_URL,
  apiRequest,
} from './api';

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  dateOfBirth?: string | null;
  role: string;
  status: string;
  themePreference:
    | 'LUXURY_GOLD'
    | 'CLASSIC_BLUE'
    | 'CITY_SKY'
    | 'LONDON_RED'
    | 'MERSEY_RED'
    | 'MADRID_ROYAL'
    | 'CATALAN_NIGHTS'
    | 'MUNICH_RED'
    | 'PARIS_NIGHT'
    | 'MILAN_BLUE'
    | 'MILAN_RED'
    | 'TURIN_MONO';

  player: {
    playerCode: string;
    profileImageUrl: string | null;

    identity: {
      inGameName: string;
      gameUid: string | null;
      isVerified: boolean;
    } | null;
  } | null;
}

declare global {
  interface Window {
    FC_ARENA_ANDROID_AUTH?: {
      flushCookies?: () => void;
    };
  }
}

const pendingReads = new Map<string, Promise<unknown>>();

const notificationRequests = new Map<string, Promise<unknown>>();
const notificationCaches = new Map<string, { value: unknown; expiresAt: number }>();
let notificationGeneration = 0;
function clearNotificationCache() { pendingReads.clear(); notificationGeneration++; notificationRequests.clear(); notificationCaches.clear(); }

let sessionEpoch = 0;
let profileEpoch = 0;
let currentUserCache: { user: CurrentUser; epoch: number; expiresAt: number } | null = null;
interface ProfileRead { promise: Promise<CurrentUser>; controller: AbortController; subscribers: number; settled: boolean; epoch: number }
let currentUserRead: ProfileRead | null = null;
function invalidateCurrentUser() { profileEpoch++; currentUserCache = null; currentUserRead = null; }

/** Refresh visible data without ending or rotating the signed-in account. */
export function invalidateAppReadCaches(): void {
  invalidateCurrentUser();
  clearNotificationCache();
}

/** Synchronous identity snapshot for already-authenticated app navigation. */
export function peekCurrentUser(): CurrentUser | null {
  return currentUserCache?.epoch === profileEpoch && currentUserCache.expiresAt > Date.now() ? currentUserCache.user : null;
}

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;

let refreshPromise:
  Promise<string> | null = null;

function flushNativeAuthCookie(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.FC_ARENA_ANDROID_AUTH?.flushCookies?.();
  } catch {
    // The native bridge is optional in normal browsers and must never block auth.
  }
}

export function establishLoginSession(
  token: string,
  expiresInSeconds: number,
): void {
  sessionEpoch++;
  invalidateCurrentUser();
  clearNotificationCache();
  accessToken = token;

  accessTokenExpiresAt =
    Date.now() +
    expiresInSeconds *
      1000;

  refreshPromise = null;
  flushNativeAuthCookie();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('fc-arena:signed-in'));
}

export async function refreshAccessToken(
  force = false,
): Promise<string> {
  const cachedToken =
    accessToken;

  const stillValid =
    cachedToken !== null &&
    Date.now() <
      accessTokenExpiresAt -
        30_000;

  if (
    !force &&
    stillValid
  ) {
    return cachedToken;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  const epoch = sessionEpoch;
  const pending =
    (async (): Promise<string> => {
      const refresh =
        await apiRequest<{
          success: true;

          data: {
            accessToken: string;
            expiresIn: number;
          };

          error: null;
        }>('/auth/refresh', {
          method: 'POST',
        });

      if (epoch !== sessionEpoch) throw new DOMException('The signed-in account changed.', 'AbortError');
      const newAccessToken =
        refresh.data.accessToken;

      accessToken =
        newAccessToken;

      accessTokenExpiresAt =
        Date.now() +
        refresh.data.expiresIn *
          1000;

      flushNativeAuthCookie();

      return newAccessToken;
    })();

  refreshPromise = pending;
  try {
    return await pending;
  } finally {
    if (refreshPromise === pending) refreshPromise = null;
  }
}

// Cancelling one page must not cancel a shared session refresh for other pages.
async function waitForSession(signal?: AbortSignal | null): Promise<string> {
  const pending = refreshAccessToken();
  if (!signal) return pending;
  let cancel = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    cancel = () => reject(signal.reason ?? new DOMException('Request cancelled.', 'AbortError'));
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
  try { return await Promise.race([pending, cancelled]); }
  finally { signal.removeEventListener('abort', cancel); }
}

export async function authenticatedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (options.signal?.aborted) throw options.signal.reason ?? new DOMException('Request cancelled.', 'AbortError');
  const token = await waitForSession(options.signal);

  const method =
    (
      options.method ||
      'GET'
    ).toUpperCase();

  if (method !== 'GET') invalidateCurrentUser();

  if (
    path.startsWith(
      '/notifications',
    ) &&
    method !== 'GET'
  ) {
    clearNotificationCache();
  }

  const perform = (bearerToken: string) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${bearerToken}`);
    return apiRequest<T>(path, { ...options, headers });
  };

  /*
   * Only idempotent reads get an automatic auth retry.
   * Mutations/uploads never replay after an ambiguous failure, preventing
   * duplicate result submissions or duplicate writes.
   */
  const request =
    async () => {
      try {
        return await perform(
          token,
        );
      } catch (
        error
      ) {
        const status =
          (
            error as {
              status?: unknown;
            } | null
          )?.status;

        if (
          method === 'GET' &&
          status === 401
        ) {
          const freshToken =
            await refreshAccessToken(
              true,
            );

          return perform(
            freshToken,
          );
        }

        throw error;
      }
    };

  if (
    path.startsWith(
      '/notifications',
    ) &&
    method !== 'GET'
  ) {
    return request()
      .finally(() => { clearNotificationCache(); invalidateCurrentUser(); });
  }

  if (
    method !== 'GET'
  ) {
    pendingReads.clear();

    return request()
      .finally(
        () => { pendingReads.clear(); invalidateCurrentUser(); },
      );
  }

  if (
    path !== '/notifications' &&
    path !== '/notifications?summary=true'
  ) {
    // Share only simultaneous, default GETs. Never cache resolved private data
    // or merge requests with different headers, signals or freshness options.
    if (
      !Object.keys(
        options,
      ).every(
        (
          key,
        ) =>
          key ===
          'method',
      )
    ) {
      return request();
    }

    const key =
      `${token}\0${path}`;

    const existing =
      pendingReads.get(
        key,
      );

    if (
      existing
    ) {
      return existing as
        Promise<T>;
    }

    const pending =
      request()
        .finally(
          () => {
            if (
              pendingReads.get(
                key,
              ) === pending
            ) {
              pendingReads.delete(
                key,
              );
            }
          },
        );

    pendingReads.set(
      key,
      pending,
    );

    return pending;
  }

  const notificationCache = notificationCaches.get(path);
  const notificationRequest = notificationRequests.get(path);

  if (
    notificationCache &&
    notificationCache
      .expiresAt >
      Date.now()
  ) {
    return notificationCache
      .value as T;
  }

  if (
    notificationRequest
  ) {
    return notificationRequest as
      Promise<T>;
  }

  const generation =
    notificationGeneration;

  const pending =
    request()
      .then(
        (
          value,
        ) => {
          if (
            generation ===
            notificationGeneration
          ) {
            notificationCaches.set(path, {
              value,
              expiresAt:
                Date.now() +
                10_000,
            });
          }

          return value;
        },
      )
      .finally(
        () => {
          if (
            notificationRequests.get(path) ===
            pending
          ) {
            notificationRequests.delete(path);
          }
        },
      );

  notificationRequests.set(path, pending);

  return pending;
}

class UploadRequestError
  extends Error {
  readonly status:
    number;

  constructor(
    message:
      string,
    status:
      number,
  ) {
    super(
      message,
    );

    this.name =
      'UploadRequestError';

    this.status =
      status;
  }
}

function sendUpload<T>(
  path: string,
  formData: FormData,
  token: string,
  onProgress?: (
    progress: number,
  ) => void,
): Promise<T> {
  return new Promise<T>(
    (
      resolve,
      reject,
    ) => {
      const xhr =
        new XMLHttpRequest();

      xhr.open(
        'POST',
        `${API_URL}${path}`,
      );

      xhr.withCredentials =
        true;

      xhr.timeout =
        120_000;

      // Slow mobile transfers may take over 30 seconds while still progressing.
      // Bound stalls separately, and never automatically replay an uncertain write.
      let stallTimer: ReturnType<typeof setTimeout>;
      const clearStall = () => clearTimeout(stallTimer);
      const resetStall = () => {
        clearStall();
        stallTimer = setTimeout(() => {
          reject(new UploadRequestError('The upload stopped responding. Check your connection and retry.', 408));
          xhr.abort();
        }, 30_000);
      };
      xhr.onprogress = resetStall;
      xhr.onabort = () => {
        clearStall();
        reject(new UploadRequestError('The upload was cancelled.', 0));
      };

      xhr.setRequestHeader(
        'Authorization',
        `Bearer ${token}`,
      );

      xhr.upload.onprogress =
        (event) => {
          resetStall();
          if (
            !event.lengthComputable ||
            !onProgress
          ) {
            return;
          }

          const percentage =
            Math.round(
              (
                event.loaded /
                event.total
              ) *
                100,
            );

          onProgress(
            percentage,
          );
        };

      xhr.onerror =
        () => {
          clearStall();
          reject(
            new UploadRequestError(
              'Unable to upload file. Check your connection and retry.',
              0,
            ),
          );
        };

      xhr.ontimeout =
        () => {
          clearStall();
          reject(
            new UploadRequestError(
              'The upload timed out. Please retry.',
              408,
            ),
          );
        };

      xhr.onload =
        () => {
          clearStall();
          let payload:
            unknown = null;

          try {
            payload =
              xhr.responseText
                ? JSON.parse(
                    xhr.responseText,
                  )
                : null;
          } catch {
            payload =
              null;
          }

          if (
            xhr.status >= 200 &&
            xhr.status < 300
          ) {
            resolve(
              payload as T,
            );

            return;
          }

          const failure =
            payload as {
              error?: {
                message?:
                  string;
              };
            } | null;

          reject(
            new UploadRequestError(
              failure
                ?.error
                ?.message ??
                'File upload failed.',
              xhr.status,
            ),
          );
        };

      resetStall();
      try { xhr.send(formData); }
      catch (error) { clearStall(); reject(error); }
    },
  );
}

export async function authenticatedUpload<T>(
  path: string,
  formData: FormData,
  onProgress?: (
    progress: number,
  ) => void,
): Promise<T> {
  invalidateCurrentUser();
  let token =
    await refreshAccessToken();

  try {
    return await sendUpload<T>(
      path,
      formData,
      token,
      onProgress,
    );
  } catch (
    error
  ) {
    /*
     * Uploads can have side effects. Retry only when the server explicitly
     * rejected authentication (401), never after network/timeout/5xx errors
     * where the upload may already have reached storage.
     */
    if (
      !(
        error instanceof
        UploadRequestError
      ) ||
      error.status !==
        401
    ) {
      throw error;
    }

    token =
      await refreshAccessToken(
        true,
      );

    return await sendUpload<T>(
      path,
      formData,
      token,
      onProgress,
    );
  } finally { invalidateCurrentUser(); }
}

export type RealtimeConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface AuthenticatedRealtimeEvent {
  event: string;
  data: unknown;
}

export function subscribeAuthenticatedEvents(
  path: string,
  onEvent: (event: AuthenticatedRealtimeEvent) => void,
  onState?: (state: RealtimeConnectionState) => void,
) {
  let stopped = false, terminal = false, retryDelay = 1_000, reconnectRequested = false;
  let attempt: AbortController | null = null;
  let wake: (() => void) | null = null;
  const active = () => navigator.onLine !== false && document.visibilityState !== 'hidden';
  const pause = (milliseconds?: number) => new Promise<void>(resolve => {
    let timer: number | undefined;
    const finish = () => { if (timer !== undefined) window.clearTimeout(timer); if (wake === finish) wake = null; resolve(); };
    wake = finish;
    if (milliseconds !== undefined) timer = window.setTimeout(finish, milliseconds);
  });
  const interrupted = () => { reconnectRequested = true; attempt?.abort(); retryDelay = 1_000; wake?.(); };
  const state = (value: RealtimeConnectionState) => { if (!stopped || value === 'disconnected') onState?.(value); };
  async function bounded<T>(work: () => Promise<T>, milliseconds: number, controller: AbortController): Promise<T> {
    if (controller.signal.aborted) throw controller.signal.reason;
    let timer: number | undefined;
    let cancel = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      cancel = () => reject(controller.signal.reason ?? new DOMException('Realtime connection interrupted.', 'AbortError'));
      controller.signal.addEventListener('abort', cancel, { once: true });
      timer = window.setTimeout(() => controller.abort(new Error('Realtime connection timed out.')), milliseconds);
    });
    try { return await Promise.race([Promise.resolve().then(work), cancelled]); }
    finally { if (timer !== undefined) window.clearTimeout(timer); controller.signal.removeEventListener('abort', cancel); }
  }
  const cleanup = () => {
    window.removeEventListener('online', interrupted); window.removeEventListener('offline', interrupted);
    document.removeEventListener('visibilitychange', interrupted);
  };
  async function connect() {
    try {
      while (!stopped && !terminal) {
        if (!active()) { state('disconnected'); await pause(); continue; }
        const controller = new AbortController(); attempt = controller; reconnectRequested = false;
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        const started = Date.now();
        try {
          state(retryDelay === 1_000 ? 'connecting' : 'reconnecting');
          const response = await bounded(async () => {
            let token = await waitForSession(controller.signal);
            const open = () => {
              if (controller.signal.aborted) throw controller.signal.reason;
              return fetch(`${API_URL}${path}`, { method: 'GET', credentials: 'include',
                headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal });
            };
            let result = await open();
            if (result.status === 401 && !stopped) {
              void result.body?.cancel().catch(() => {});
              token = await refreshAccessToken(true);
              if (controller.signal.aborted) throw controller.signal.reason;
              result = await open();
            }
            return result;
          }, 15_000, controller);
          if ([401, 403, 404].includes(response.status)) { terminal = true; void response.body?.cancel().catch(() => {}); continue; }
          if (!response.ok || !response.body) { void response.body?.cancel().catch(() => {}); throw new Error('Realtime stream unavailable.'); }
          state('connected');
          reader = response.body.getReader();
          const decoder = new TextDecoder(); let buffer = '';
          while (!stopped && !controller.signal.aborted) {
            // The server sends a heartbeat every 20s. A half-open mobile socket
            // must reconnect instead of staying marked connected indefinitely.
            const { value, done } = await bounded(() => reader!.read(), 60_000, controller);
            if (done) throw new Error('Realtime connection closed.');
            if (Date.now() - started >= 20_000) retryDelay = 1_000;
            buffer = (buffer + decoder.decode(value, { stream: true })).replaceAll('\r\n', '\n');
            if (buffer.length > 65_536) throw new Error('Realtime frame too large.');
            let boundary: number;
            while ((boundary = buffer.indexOf('\n\n')) >= 0) {
              const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
              let event = 'message'; const data: string[] = [];
              for (const line of frame.split('\n')) {
                if (line.startsWith('event:')) event = line.slice(6).trim();
                if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
              }
              if (data.length) {
                const raw = data.join('\n'); let payload: unknown = raw;
                try { payload = JSON.parse(raw); } catch { /* Text events are valid SSE. */ }
                if (!stopped && !controller.signal.aborted) onEvent({ event, data: payload });
              }
            }
          }
        } catch (error) {
          if ((error as { status?: number } | null)?.status === 401 || (error as { status?: number } | null)?.status === 403) terminal = true;
        } finally {
          controller.abort();
          if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
          if (attempt === controller) attempt = null;
        }
        if (stopped || terminal) break;
        if (!active()) continue;
        if (reconnectRequested) continue;
        state('reconnecting');
        await pause(retryDelay);
        retryDelay = Math.min(retryDelay * 2, 10_000);
      }
    } finally { cleanup(); state('disconnected'); }
  }
  window.addEventListener('online', interrupted); window.addEventListener('offline', interrupted);
  document.addEventListener('visibilitychange', interrupted);
  void connect();
  return () => { stopped = true; attempt?.abort(); wake?.(); cleanup(); state('disconnected'); };
}

export async function getCurrentUser(options: RequestInit = {}): Promise<CurrentUser> {
  const signal = options.signal;
  if (signal?.aborted) throw signal.reason ?? new DOMException('Request cancelled.', 'AbortError');
  // Cache only this small identity projection in memory. Competition data always
  // revalidates, and explicit freshness/header options bypass this optimization.
  if ((options.method ?? 'GET').toUpperCase() !== 'GET' || Object.keys(options).some(key => key !== 'signal' && key !== 'method')) {
    return (await authenticatedRequest<{ data: { user: CurrentUser } }>('/auth/me', options)).data.user;
  }
  if (currentUserCache?.epoch === profileEpoch && currentUserCache.expiresAt > Date.now()) return currentUserCache.user;
  let read = currentUserRead;
  if (!read || read.epoch !== profileEpoch) {
    const controller = new AbortController(), epoch = profileEpoch, account = sessionEpoch;
    const job: ProfileRead = { controller, epoch, subscribers: 0, settled: false, promise: Promise.resolve(null as unknown as CurrentUser) };
    job.promise = authenticatedRequest<{ data: { user: CurrentUser } }>('/auth/me', { signal: controller.signal }).then(result => {
      if (account !== sessionEpoch) throw new DOMException('The signed-in account changed.', 'AbortError');
      if (epoch === profileEpoch) currentUserCache = { user: result.data.user, epoch, expiresAt: Date.now() + 30_000 };
      return result.data.user;
    }).finally(() => { job.settled = true; if (currentUserRead === job) currentUserRead = null; });
    currentUserRead = job; read = job;
  }
  const job = read;
  job.subscribers++;
  return new Promise<CurrentUser>((resolve, reject) => {
    let finished = false;
    const finish = (failed: boolean, error: unknown, value?: CurrentUser) => {
      if (finished) return;
      finished = true; signal?.removeEventListener('abort', cancel); job.subscribers--;
      if (!job.settled && job.subscribers === 0) {
        if (currentUserRead === job) currentUserRead = null;
        job.controller.abort();
      }
      if (failed) reject(error); else resolve(value!);
    };
    const cancel = () => finish(true, signal?.reason ?? new DOMException('Request cancelled.', 'AbortError'));
    signal?.addEventListener('abort', cancel, { once: true });
    job.promise.then(value => finish(false, null, value), error => finish(true, error));
    if (signal?.aborted) cancel();
  });
}

export async function logoutCurrentUser(): Promise<void> {
  try {
    await apiRequest(
      '/auth/logout',
      {
        method: 'POST',
      },
    );
  } finally {
    sessionEpoch++; invalidateCurrentUser();
    clearNotificationCache();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("fc-arena:signed-out"));
    accessToken = null;
    accessTokenExpiresAt = 0;
    refreshPromise = null;

    if (
      typeof window !==
      'undefined'
    ) {
      window.localStorage.removeItem(
        'fc-arena-theme-preference',
      );

      document.documentElement
        .dataset
        .theme =
        'classic-blue';
    }
  }
}

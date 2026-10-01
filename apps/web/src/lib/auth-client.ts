import {
  API_URL,
  apiRequest,
} from './api';

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  role: string;
  status: string;
  themePreference:
    | 'LUXURY_GOLD'
    | 'CLASSIC_BLUE';

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

let notificationRequest: Promise<unknown> | null = null;
let notificationCache: { value: unknown; expiresAt: number } | null = null;
let notificationGeneration = 0;
function clearNotificationCache() { notificationGeneration++; notificationRequest = null; notificationCache = null; }

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;

let refreshPromise:
  Promise<string> | null = null;


export function establishLoginSession(
  token: string,
  expiresInSeconds: number,
): void {
  clearNotificationCache();
  accessToken = token;

  accessTokenExpiresAt =
    Date.now() +
    expiresInSeconds *
      1000;

  refreshPromise = null;
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

  refreshPromise =
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

      const newAccessToken =
        refresh.data.accessToken;

      accessToken =
        newAccessToken;

      accessTokenExpiresAt =
        Date.now() +
        refresh.data.expiresIn *
          1000;

      return newAccessToken;
    })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function authenticatedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    await refreshAccessToken();

  const method = (options.method || 'GET').toUpperCase();
  if (path.startsWith('/notifications') && method !== 'GET') clearNotificationCache();
  const request = () => apiRequest<T>(path, { ...options, headers: { ...(options.headers ?? {}), Authorization: `Bearer ${token}` } });
  if (path.startsWith('/notifications') && method !== 'GET') return request().finally(clearNotificationCache);
  if (path !== '/notifications' || method !== 'GET') return request();
  if (notificationCache && notificationCache.expiresAt > Date.now()) return notificationCache.value as T;
  if (notificationRequest) return notificationRequest as Promise<T>;
  const generation = notificationGeneration;
  const pending = request().then(value => { if (generation === notificationGeneration) notificationCache = { value, expiresAt: Date.now() + 10_000 }; return value; }).finally(() => { if (notificationRequest === pending) notificationRequest = null; });
  notificationRequest = pending;
  return pending;
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

      xhr.setRequestHeader(
        'Authorization',
        `Bearer ${token}`,
      );

      xhr.upload.onprogress =
        (event) => {
          if (
            !event.lengthComputable ||
            !onProgress
          ) {
            return;
          }

          const percentage =
            Math.round(
              (event.loaded /
                event.total) *
                100,
            );

          onProgress(
            percentage,
          );
        };

      xhr.onerror = () => {
        reject(
          new Error(
            'Unable to upload file.',
          ),
        );
      };

      xhr.onload = () => {
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
          payload = null;
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
              message?: string;
            };
          } | null;

        reject(
          new Error(
            failure?.error
              ?.message ??
              'File upload failed.',
          ),
        );
      };

      xhr.send(
        formData,
      );
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
  let token =
    await refreshAccessToken();

  try {
    return await sendUpload<T>(
      path,
      formData,
      token,
      onProgress,
    );
  } catch (error) {
    if (
      !(error instanceof Error)
    ) {
      throw error;
    }

    /*
     * Retry once using a
     * freshly rotated access token.
     */
    token =
      await refreshAccessToken(
        true,
      );

    return sendUpload<T>(
      path,
      formData,
      token,
      onProgress,
    );
  }
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
  onEvent:
    (
      event:
        AuthenticatedRealtimeEvent,
    ) => void,
  onState?:
    (
      state:
        RealtimeConnectionState,
    ) => void,
) {
  const controller =
    new AbortController();

  let stopped =
    false;

  let retryDelay =
    1_000;

  const sleep =
    (
      milliseconds:
        number,
    ) =>
      new Promise<void>(
        (
          resolve,
        ) => {
          window.setTimeout(
            resolve,
            milliseconds,
          );
        },
      );

  const connect =
    async () => {
      while (
        !stopped
      ) {
        try {
          onState?.(
            retryDelay ===
              1_000
              ? 'connecting'
              : 'reconnecting',
          );

          let token =
            await refreshAccessToken();

          let response =
            await fetch(
              `${API_URL}${path}`,
              {
                method:
                  'GET',

                credentials:
                  'include',

                headers: {
                  Accept:
                    'text/event-stream',

                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  'no-store',

                signal:
                  controller.signal,
              },
            );

          if (
            response.status ===
            401 &&
            !stopped
          ) {
            token =
              await refreshAccessToken(
                true,
              );

            response =
              await fetch(
                `${API_URL}${path}`,
                {
                  method:
                    'GET',

                  credentials:
                    'include',

                  headers: {
                    Accept:
                      'text/event-stream',

                    Authorization:
                      `Bearer ${token}`,
                  },

                  cache:
                    'no-store',

                  signal:
                    controller.signal,
                },
              );
          }

          if (
            !response.ok ||
            !response.body
          ) {
            throw new Error(
              'Realtime stream unavailable.',
            );
          }

          onState?.(
            'connected',
          );

          retryDelay =
            1_000;

          const reader =
            response.body
              .getReader();

          const decoder =
            new TextDecoder();

          let buffer =
            '';

          while (
            !stopped
          ) {
            const {
              value,
              done,
            } =
              await reader.read();

            if (
              done
            ) {
              break;
            }

            buffer +=
              decoder.decode(
                value,
                {
                  stream:
                    true,
                },
              );

            buffer =
              buffer.replaceAll(
                '\r\n',
                '\n',
              );

            let boundary =
              buffer.indexOf(
                '\n\n',
              );

            while (
              boundary >=
              0
            ) {
              const frame =
                buffer
                  .slice(
                    0,
                    boundary,
                  )
                  .trim();

              buffer =
                buffer.slice(
                  boundary +
                    2,
                );

              if (
                frame &&
                !frame.startsWith(
                  ':',
                )
              ) {
                let event =
                  'message';

                const dataLines:
                  string[] =
                  [];

                for (
                  const line
                  of frame.split(
                    '\n',
                  )
                ) {
                  if (
                    line.startsWith(
                      'event:',
                    )
                  ) {
                    event =
                      line
                        .slice(
                          6,
                        )
                        .trim();
                  }

                  if (
                    line.startsWith(
                      'data:',
                    )
                  ) {
                    dataLines.push(
                      line
                        .slice(
                          5,
                        )
                        .trimStart(),
                    );
                  }
                }

                if (
                  dataLines.length >
                  0
                ) {
                  const raw =
                    dataLines.join(
                      '\n',
                    );

                  let data:
                    unknown =
                    raw;

                  try {
                    data =
                      JSON.parse(
                        raw,
                      );
                  } catch {
                    // Plain text
                    // SSE payloads are
                    // still valid.
                  }

                  onEvent({
                    event,
                    data,
                  });
                }
              }

              boundary =
                buffer.indexOf(
                  '\n\n',
                );
            }
          }

          if (
            !stopped
          ) {
            throw new Error(
              'Realtime connection closed.',
            );
          }
        } catch (
          error
        ) {
          if (
            stopped ||
            controller.signal
              .aborted
          ) {
            break;
          }

          onState?.(
            'reconnecting',
          );

          await sleep(
            retryDelay,
          );

          retryDelay =
            Math.min(
              retryDelay *
                2,
              10_000,
            );
        }
      }

      onState?.(
        'disconnected',
      );
    };

  void connect();

  return () => {
    stopped =
      true;

    controller.abort();

    onState?.(
      'disconnected',
    );
  };
}


export async function getCurrentUser(): Promise<CurrentUser> {
  const result =
    await authenticatedRequest<{
      success: true;

      data: {
        user:
          CurrentUser;
      };

      error: null;
    }>('/auth/me');

  return result.data.user;
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
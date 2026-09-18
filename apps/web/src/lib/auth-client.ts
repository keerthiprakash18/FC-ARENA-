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

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;

let refreshPromise:
  Promise<string> | null = null;

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

  return apiRequest<T>(
    path,
    {
      ...options,

      headers: {
        ...(options.headers ??
          {}),

        Authorization:
          `Bearer ${token}`,
      },
    },
  );
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
            'Unable to upload screenshot.',
          ),
        );
      };

      xhr.onload = () => {
        let payload:
          any = null;

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

        reject(
          new Error(
            payload?.error
              ?.message ??
              'Screenshot upload failed.',
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
    accessToken = null;
    accessTokenExpiresAt = 0;
    refreshPromise = null;
  }
}
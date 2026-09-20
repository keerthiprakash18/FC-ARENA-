'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  usePathname,
} from 'next/navigation';

import {
  authenticatedRequest,
  getCurrentUser,
} from '@/lib/auth-client';

import {
  applyThemePreference,
  DEFAULT_THEME_PREFERENCE,
  readCachedThemePreference,
  type ThemePreference,
} from '@/lib/theme';


interface ThemeContextValue {
  themePreference:
    ThemePreference;

  initializing:
    boolean;

  setThemePreference:
    (
      theme:
        ThemePreference,
      persist?:
        boolean,
    ) =>
      Promise<void>;
}


const ThemeContext =
  createContext<
    ThemeContextValue | null
  >(
    null,
  );


const publicPaths = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const;


function isPublicPath(
  pathname:
    string,
) {
  return publicPaths.some(
    (
      path,
    ) =>
      pathname ===
        path ||
      pathname.startsWith(
        `${path}/`,
      ),
  );
}


export function ThemeProvider({
  children,
}: {
  children:
    ReactNode;
}) {
  const pathname =
    usePathname();

  const [
    themePreference,
    setThemeState,
  ] =
    useState<ThemePreference>(
      DEFAULT_THEME_PREFERENCE,
    );

  const [
    initializing,
    setInitializing,
  ] =
    useState(
      true,
    );

  const [
    syncedAuthenticatedUser,
    setSyncedAuthenticatedUser,
  ] =
    useState(
      false,
    );


  useEffect(() => {
    const cached =
      readCachedThemePreference();

    setThemeState(
      cached,
    );

    applyThemePreference(
      cached,
      false,
    );

    setInitializing(
      false,
    );
  }, []);


  useEffect(() => {
    if (
      isPublicPath(
        pathname,
      ) ||
      syncedAuthenticatedUser
    ) {
      return;
    }

    let cancelled =
      false;

    void (async () => {
      try {
        const user =
          await getCurrentUser();

        if (
          cancelled
        ) {
          return;
        }

        setThemeState(
          user.themePreference,
        );

        applyThemePreference(
          user.themePreference,
        );

        setSyncedAuthenticatedUser(
          true,
        );
      } catch {
        // Authenticated pages already own redirect handling.
        // Keep the cached/default theme while they resolve auth.
      }
    })();

    return () => {
      cancelled =
        true;
    };
  }, [
    pathname,
    syncedAuthenticatedUser,
  ]);


  const setThemePreference =
    useCallback(
      async (
        nextTheme:
          ThemePreference,
        persist =
          true,
      ) => {
        const previous =
          themePreference;

        setThemeState(
          nextTheme,
        );

        applyThemePreference(
          nextTheme,
        );

        if (
          !persist
        ) {
          return;
        }

        try {
          await authenticatedRequest(
            '/auth/preferences/theme',
            {
              method:
                'PATCH',

              body:
                JSON.stringify({
                  themePreference:
                    nextTheme,
                }),
            },
          );
        } catch (
          error
        ) {
          setThemeState(
            previous,
          );

          applyThemePreference(
            previous,
          );

          throw error;
        }
      },
      [
        themePreference,
      ],
    );


  const value =
    useMemo(
      () => ({
        themePreference,
        initializing,
        setThemePreference,
      }),
      [
        themePreference,
        initializing,
        setThemePreference,
      ],
    );


  return (
    <ThemeContext.Provider
      value={
        value
      }
    >
      {children}
    </ThemeContext.Provider>
  );
}


export function useTheme() {
  const value =
    useContext(
      ThemeContext,
    );

  if (
    !value
  ) {
    throw new Error(
      'useTheme must be used inside ThemeProvider.',
    );
  }

  return value;
}

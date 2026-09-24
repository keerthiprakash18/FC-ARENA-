'use client';

import {
  useEffect,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  getCurrentUser,
} from '@/lib/auth-client';


export function SessionRedirect() {
  const router =
    useRouter();

  useEffect(
    () => {
      let active =
        true;

      void getCurrentUser()
        .then(
          () => {
            if (
              active
            ) {
              router.replace(
                '/dashboard',
              );
            }
          },
        )
        .catch(
          () =>
            undefined,
        );

      return () => {
        active =
          false;
      };
    },
    [
      router,
    ],
  );

  return null;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth-client';

export function HomeSessionRedirect() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    void getCurrentUser()
      .then(() => {
        if (active) {
          router.replace('/dashboard');
        }
      })
      .catch(() => {
        // The public home page remains available when there is no valid session.
      });

    return () => {
      active = false;
    };
  }, [router]);

  return null;
}

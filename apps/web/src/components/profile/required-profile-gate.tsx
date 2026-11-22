'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getCurrentUser, type CurrentUser } from '@/lib/auth-client';
import {
  needsRequiredProfile,
  signedInDestination,
} from '@/lib/required-profile';
export function RequiredProfileGate({
  currentUser,
}: {
  currentUser?: CurrentUser;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    [loaded, setLoaded] = useState<CurrentUser | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (!currentUser)
      void getCurrentUser({ signal: controller.signal })
        .then((user) => {
          if (!controller.signal.aborted) setLoaded(user);
        })
        .catch(() => {});
    return () => controller.abort();
  }, [currentUser]);
  const user = currentUser ?? loaded;
  useEffect(() => {
    if (
      user &&
      needsRequiredProfile(user) &&
      !pathname.startsWith('/settings') &&
      pathname !== '/profile/complete'
    )
      router.replace(signedInDestination(user, window.location.search));
  }, [user, pathname, router]);
  return null;
}

'use client';

import {
  usePathname,
} from 'next/navigation';

import {
  useEffect,
  useState,
} from 'react';

import {
  getCurrentUser,
} from '@/lib/auth-client';

import { FcContextNav } from '@/components/fc/fc-context-nav';

const adminItems = [
  [
    'Analytics',
    '/admin/analytics',
  ],
  [
    'Leagues',
    '/admin/leagues',
  ],
  [
    'Tournaments',
    '/admin/tournaments',
  ],
  [
    'Teams',
    '/admin/teams',
  ],
  [
    'Results',
    '/admin/results',
  ],
  [
    'Disputes',
    '/admin/disputes',
  ],
  [
    'Fair Play',
    '/admin/fair-play',
  ],
  [
    'Ballon',
    '/admin/ballon',
  ],
] as const;

const superAdminItems = [
  [
    'System',
    '/admin/system',
  ],
  [
    'Android',
    '/admin/android',
  ],
] as const;

export function AdminNavigation() {
  const pathname =
    usePathname();

  const [
    superAdmin,
    setSuperAdmin,
  ] =
    useState(
      false,
    );

  useEffect(() => {
    let active =
      true;

    void getCurrentUser()
      .then(
        (
          user,
        ) => {
          if (
            active
          ) {
            setSuperAdmin(
              user.role ===
                'SUPER_ADMIN',
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
  }, []);

  const items =
    superAdmin
      ? [
          ...adminItems,
          ...superAdminItems,
        ]
      : adminItems;

  return (
    <FcContextNav
      ariaLabel="Admin sections"
      items={items.map(([label, href]) => ({
        label,
        href,
        active: pathname === href,
      }))}
    />
  );
}

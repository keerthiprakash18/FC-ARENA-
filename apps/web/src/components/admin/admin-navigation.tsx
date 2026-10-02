'use client';

import Link from 'next/link';

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
    'Ballon',
    '/admin/ballon',
  ],
] as const;

const superAdminItems = [
  [
    'Privacy',
    '/admin/privacy',
  ],
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
    <nav
      className="overflow-x-auto rounded-2xl border border-[#253140] bg-[#121821] p-1.5"
      aria-label="Admin sections"
    >
      <div className="flex min-w-max gap-1.5">
        {items.map(
          (
            [
              label,
              href,
            ],
          ) => (
            <Link
              key={
                href
              }
              href={
                href
              }
              aria-current={
                pathname ===
                href
                  ? 'page'
                  : undefined
              }
              className={
                'rounded-[10px] border px-3.5 py-2.5 text-xs font-medium transition sm:text-sm ' +
                (
                  pathname ===
                  href
                    ? 'border-transparent bg-amber-400/[0.08] text-[#F8FAFC]'
                    : 'border-transparent text-[#A7B0BE] hover:bg-[#151C26] hover:text-[#F8FAFC]'
                )
              }
            >
              {
                label
              }
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}

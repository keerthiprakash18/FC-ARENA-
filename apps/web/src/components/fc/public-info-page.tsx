import Link from 'next/link';
import type {
  ReactNode,
} from 'react';

import {
  FcIcon,
} from '@/components/fc/fc-icons';

const publicLinks = [
  {
    href:
      '/about',
    label:
      'About',
  },
  {
    href:
      '/help',
    label:
      'Help',
  },
  {
    href:
      '/privacy',
    label:
      'Privacy',
  },
  {
    href:
      '/terms',
    label:
      'Terms',
  },
] as const;

export function PublicInfoPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="fc-public-page min-h-screen">
      <header className="fc-public-header border-b">
        <div className="mx-auto flex min-h-[68px] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3"
            aria-label="FC ARENA home"
          >
            <span className="theme-brand-mark grid h-10 w-10 place-items-center rounded-xl border">
              <FcIcon
                name="football"
                size={21}
              />
            </span>

            <span className="theme-text fc-display text-lg font-semibold">
              FC{' '}
              <span className="theme-text-link">
                ARENA
              </span>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-1 sm:flex"
            aria-label="Public information"
          >
            {publicLinks.map(
              (
                item,
              ) => (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  className="theme-ghost-button inline-flex min-h-10 items-center rounded-[10px] px-3 text-sm font-medium"
                >
                  {
                    item.label
                  }
                </Link>
              ),
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-3xl">
          <p className="theme-text-link text-xs font-semibold uppercase tracking-[0.12em]">
            {
              eyebrow
            }
          </p>

          <h1 className="theme-text fc-display-strong mt-2 text-3xl leading-tight sm:text-4xl">
            {
              title
            }
          </h1>

          <p className="theme-secondary-text mt-4 max-w-2xl text-base leading-7">
            {
              description
            }
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {
            children
          }
        </div>

        <footer className="theme-divider mt-12 border-t pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="theme-muted text-xs">
              FC ARENA · More Than A Game
            </p>

            <div className="flex flex-wrap gap-2 sm:hidden">
              {publicLinks.map(
                (
                  item,
                ) => (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      item.href
                    }
                    className="theme-ghost-button inline-flex min-h-10 items-center rounded-[10px] px-3 text-sm font-medium"
                  >
                    {
                      item.label
                    }
                  </Link>
                ),
              )}
            </div>

            <Link
              href="/login"
              className="theme-primary-button inline-flex min-h-11 items-center justify-center rounded-[10px] px-4 text-sm font-semibold"
            >
              Open FC ARENA
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

export function PublicInfoCard({
  title,
  children,
  icon =
    'info',
}: {
  title: string;
  children: ReactNode;
  icon?:
    Parameters<
      typeof FcIcon
    >[0]['name'];
}) {
  return (
    <section className="theme-panel rounded-2xl border p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="theme-soft-accent grid h-10 w-10 shrink-0 place-items-center rounded-xl border">
          <FcIcon
            name={
              icon
            }
            size={19}
          />
        </span>

        <div className="min-w-0">
          <h2 className="theme-text text-lg font-semibold">
            {
              title
            }
          </h2>

          <div className="theme-secondary-text mt-2 space-y-3 text-sm leading-7">
            {
              children
            }
          </div>
        </div>
      </div>
    </section>
  );
}

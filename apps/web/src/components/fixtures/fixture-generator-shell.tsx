'use client';

import Link from 'next/link';
import type {
  ReactNode,
} from 'react';

const steps = [
  {
    key: 'SETUP',
    label: 'Setup',
    href: '/fixtures/generate',
  },
  {
    key: 'PARTICIPANTS',
    label: 'Participants',
    href: '/fixtures/generate/participants',
  },
  {
    key: 'RULES',
    label: 'Rules',
    href: '/fixtures/generate/rules',
  },
  {
    key: 'PREVIEW',
    label: 'Preview',
    href: '/fixtures/generate/preview',
  },
  {
    key: 'SAVE',
    label: 'Save',
    href: '/fixtures/generate/save',
  },
] as const;

export type FixtureGeneratorStep =
  typeof steps[number]['key'];

export function FixtureGeneratorShell({
  step,
  title,
  description,
  children,
}: {
  step:
    FixtureGeneratorStep;
  title: string;
  description: string;
  children:
    ReactNode;
}) {
  const currentIndex =
    steps.findIndex(
      (
        item,
      ) =>
        item.key ===
        step,
    );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/fixtures"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#6F7B8A] transition hover:text-[#38BDF8]"
        >
          ← Fixtures
        </Link>

        <p className="mt-5 text-xs font-medium text-[#6F7B8A]">
          Fixture Generator
        </p>

        <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.025em] text-[#F8FAFC] sm:text-[32px]">
          {title}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A7B0BE]">
          {description}
        </p>
      </div>


      <nav className="overflow-x-auto rounded-2xl border border-[#253140] bg-[#121821] p-1.5">
        <div className="flex min-w-max gap-1">
          {steps.map(
            (
              item,
              index,
            ) => {
              const active =
                item.key ===
                step;

              const complete =
                index <
                currentIndex;

              return (
                <Link
                  key={
                    item.key
                  }
                  href={
                    index <=
                    currentIndex
                      ? item.href
                      : '#'
                  }
                  aria-disabled={
                    index >
                    currentIndex
                  }
                  className={`rounded-[10px] px-3.5 py-2.5 text-xs font-medium transition ${
                    active
                      ? 'bg-sky-400/[0.10] text-[#F8FAFC]'
                      : complete
                        ? 'text-emerald-300'
                        : 'pointer-events-none text-[#6F7B8A]'
                  }`}
                >
                  <span className="mr-1.5">
                    {complete
                      ? '✓'
                      : index +
                        1}
                  </span>

                  {
                    item.label
                  }
                </Link>
              );
            },
          )}
        </div>
      </nav>


      {
        children
      }
    </div>
  );
}

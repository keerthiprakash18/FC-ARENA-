'use client';

import Link from 'next/link';
import type {
  ReactNode,
} from 'react';

import { FcContextNav } from '@/components/fc/fc-context-nav';

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
      <div className="fc-fixture-generator-header">
        <Link
          href="/fixtures"
          className="fc-back-link theme-text-link inline-flex items-center gap-2 text-sm font-semibold transition"
        >
          <span aria-hidden="true">←</span>
          Fixtures
        </Link>

        <p className="theme-muted mt-5 text-xs font-semibold">
          Fixture Generator
        </p>

        <h1 className="theme-text fc-display-strong mt-1 text-[26px] leading-tight sm:text-[32px]">
          {title}
        </h1>

        <p className="theme-secondary-text mt-2 max-w-2xl text-sm leading-6">
          {description}
        </p>
      </div>

      <FcContextNav
        ariaLabel="Fixture generator steps"
        items={steps.map((item, index) => ({
          label: (
            <>
              <span className="fc-context-nav-number" aria-hidden="true">
                {index + 1}
              </span>
              {item.label}
            </>
          ),
          href: item.href,
          active: item.key === step,
          complete: index < currentIndex,
          disabled: index > currentIndex,
        }))}
      />

      {
        children
      }
    </div>
  );
}

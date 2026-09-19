'use client';

import Link from 'next/link';
import type {
  ReactNode,
} from 'react';

export type TournamentWizardStep =
  | 'SETUP'
  | 'TEAMS'
  | 'GROUPS'
  | 'FIXTURE_SETTINGS'
  | 'FIXTURE_PREVIEW'
  | 'QUALIFICATION'
  | 'REVIEW';

const stepLabels:
  Record<
    TournamentWizardStep,
    string
  > = {
    SETUP: 'Setup',
    TEAMS: 'Teams',
    GROUPS: 'Groups',
    FIXTURE_SETTINGS:
      'Fixture Settings',
    FIXTURE_PREVIEW:
      'Fixture Preview',
    QUALIFICATION:
      'Qualification',
    REVIEW: 'Review',
  };

const stepRoutes:
  Record<
    TournamentWizardStep,
    string
  > = {
    SETUP: 'setup',
    TEAMS: 'teams',
    GROUPS: 'groups',
    FIXTURE_SETTINGS:
      'fixture-settings',
    FIXTURE_PREVIEW:
      'fixture-preview',
    QUALIFICATION:
      'qualification',
    REVIEW: 'review',
  };

interface Props {
  tournamentId: string;

  currentStep:
    TournamentWizardStep;

  steps:
    TournamentWizardStep[];

  title: string;

  description?: string;

  children:
    ReactNode;
}

export function TournamentWizardShell({
  tournamentId,
  currentStep,
  steps,
  title,
  description,
  children,
}: Props) {
  const currentIndex =
    steps.indexOf(
      currentStep,
    );

  return (
    <div className="space-y-7">

      <div>
        <Link
          href="/tournaments"
          className="text-sm font-black text-slate-500 transition hover:text-white"
        >
          ← Tournaments
        </Link>

        <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-sky-400">
          Tournament Builder
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] md:text-5xl">
          {title}
        </h1>

        {description ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>


      <section className="overflow-x-auto rounded-[22px] border border-white/10 bg-[#0a1018] p-4">

        <div className="flex min-w-max items-center gap-2">

          {steps.map(
            (
              step,
              index,
            ) => {
              const active =
                step ===
                currentStep;

              const complete =
                index <
                currentIndex;

              return (
                <div
                  key={
                    step
                  }
                  className="flex items-center gap-2"
                >
                  <Link
                    href={`/tournaments/${tournamentId}/wizard/${stepRoutes[step]}`}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-black transition ${
                      active
                        ? 'border-sky-400/40 bg-sky-400/10 text-sky-300'
                        : complete
                          ? 'border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-300'
                          : 'border-white/10 bg-black/10 text-slate-500'
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-lg ${
                        active
                          ? 'bg-sky-400 text-[#041019]'
                          : complete
                            ? 'bg-emerald-400/10 text-emerald-300'
                            : 'bg-white/[0.04]'
                      }`}
                    >
                      {complete
                        ? '✓'
                        : index +
                          1}
                    </span>

                    {
                      stepLabels[
                        step
                      ]
                    }
                  </Link>

                  {index <
                  steps.length -
                    1 ? (
                    <span className="text-slate-700">
                      →
                    </span>
                  ) : null}
                </div>
              );
            },
          )}

        </div>
      </section>


      <section className="rounded-[28px] border border-white/10 bg-[#0a1018] p-5 sm:p-6 md:p-8">

        {children}

      </section>

    </div>
  );
}
"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type TournamentWizardStep =
  | "SETUP"
  | "TEAMS"
  | "GROUPS"
  | "FIXTURE_SETTINGS"
  | "FIXTURE_PREVIEW"
  | "QUALIFICATION"
  | "REVIEW";

const stepLabels: Record<TournamentWizardStep, string> = {
  SETUP: "Setup",
  TEAMS: "Teams",
  GROUPS: "Groups",
  FIXTURE_SETTINGS: "Fixture Settings",
  FIXTURE_PREVIEW: "Fixture Preview",
  QUALIFICATION: "Qualification",
  REVIEW: "Review",
};

const stepRoutes: Record<TournamentWizardStep, string> = {
  SETUP: "setup",
  TEAMS: "teams",
  GROUPS: "groups",
  FIXTURE_SETTINGS: "fixture-settings",
  FIXTURE_PREVIEW: "fixture-preview",
  QUALIFICATION: "qualification",
  REVIEW: "review",
};

interface Props {
  tournamentId: string;

  currentStep: TournamentWizardStep;

  steps: TournamentWizardStep[];

  title: string;

  description?: string;

  children: ReactNode;
}

export function TournamentWizardShell({
  tournamentId,
  currentStep,
  steps,
  title,
  description,
  children,
}: Props) {
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="space-y-7">
      <div>
        <Link
          href="/tournaments"
          className="fc-back-link theme-text-link text-sm font-semibold transition"
        >
          ← Tournaments
        </Link>

        <p className="theme-muted mt-6 text-xs font-semibold">
          Tournament Builder
        </p>

        <h1 className="theme-text fc-display-strong mt-2 text-4xl md:text-5xl">
          {title}
        </h1>

        {description ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>

      <div className="theme-panel rounded-xl p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>Step {currentIndex + 1} of {steps.length} · {stepLabels[currentStep]}</span><Link className="theme-text-link font-semibold" href={`/tournaments/${tournamentId}`}>Exit builder</Link></div><progress className="mt-3 h-2 w-full" value={currentIndex + 1} max={steps.length} aria-label="Builder step progress"/><p className="mt-2 text-xs theme-muted">Save changes using the button on each step before leaving. Your saved tournament can be resumed from Tournaments.</p></div>
      <section className="fc-context-nav overflow-x-auto rounded-[22px] border p-4">
        <div className="flex min-w-max items-center gap-2">
          {steps.map((step, index) => {
            const active = step === currentStep;

            const complete = index < currentIndex;

            return (
              <div key={step} className="flex items-center gap-2">
                <Link
                  href={`/tournaments/${tournamentId}/wizard/${stepRoutes[step]}`}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-black transition ${
                    active
                      ? "border-transparent bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                      : complete
                        ? "border-emerald-400/20 bg-emerald-400/[0.04] text-emerald-300"
                        : "border-transparent bg-[var(--theme-secondary-background)] text-[var(--theme-text-muted)]"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-lg ${
                      active
                        ? "bg-[var(--theme-primary)] text-white"
                        : complete
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-[var(--theme-surface)]"
                    }`}
                  >
                    {complete ? "✓" : index + 1}
                  </span>

                  {stepLabels[step]}
                </Link>

                {index < steps.length - 1 ? (
                  <span className="theme-muted">→</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="theme-panel rounded-[28px] border p-5 sm:p-6 md:p-8">
        {children}
      </section>
    </div>
  );
}

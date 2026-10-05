"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { FcContextNav } from '@/components/fc/fc-context-nav';

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
    <div className="fc-wizard-shell space-y-7">
      <div>
        <Link
          href="/tournaments"
          className="fc-back-link theme-text-link text-sm font-semibold transition"
        >
          <span aria-hidden="true">←</span> Tournaments
        </Link>

        <p className="theme-muted mt-6 text-xs font-semibold">
          Tournament Builder
        </p>

        <h1 className="theme-text fc-display-strong mt-2 text-4xl md:text-5xl">
          {title}
        </h1>

        {description ? (
          <p className="theme-secondary-text mt-3 max-w-3xl text-sm leading-6">
            {description}
          </p>
        ) : null}
      </div>

      <section className="fc-wizard-progress theme-panel rounded-xl p-4" aria-label="Tournament builder progress">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="theme-text font-semibold">Step {currentIndex + 1} of {steps.length}<span className="theme-muted hidden sm:inline"> · {stepLabels[currentStep]}</span></p>
          <Link className="theme-text-link font-semibold" href={`/tournaments/${tournamentId}`}>Exit builder</Link>
        </div>
        <progress className="mt-3 h-2 w-full" value={currentIndex + 1} max={steps.length} aria-label={`Builder step ${currentIndex + 1} of ${steps.length}`} />
        <p className="theme-muted mt-2 text-xs leading-5">Save changes before leaving a step. Your saved tournament can be resumed from Tournaments.</p>
      </section>

      <FcContextNav
        ariaLabel="Tournament builder steps"
        items={steps.map((step, index) => ({
          label: stepLabels[step],
          href: `/tournaments/${tournamentId}/wizard/${stepRoutes[step]}`,
          active: step === currentStep,
          complete: index < currentIndex,
        }))}
      />

      <section className="fc-wizard-content theme-panel rounded-[28px] border p-5 sm:p-6 md:p-8">
        {children}
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { FcContextNav } from '@/components/fc/fc-context-nav';
import { BackHeader } from '@/components/app/back-header';

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
  QUALIFICATION: "Playoff Setup",
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
    <div className="fc-wizard-shell grid">
      <BackHeader backHref="/tournaments" backLabel="Tournaments" eyebrow="Tournament builder" title={title} subtitle={description} />

      <section className="fc-wizard-progress theme-panel rounded-xl p-4" aria-label="Tournament builder progress">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="theme-text font-semibold">Step {currentIndex + 1} of {steps.length} <span className="theme-muted">· {stepLabels[currentStep]}</span></p>
          <Link className="theme-secondary-button inline-flex min-h-11 items-center rounded-xl px-3 font-semibold" href={`/tournaments/${tournamentId}`}>Exit builder</Link>
        </div>
        <progress className="mt-3 h-2 w-full" value={currentIndex + 1} max={steps.length} aria-label={`Builder step ${currentIndex + 1} of ${steps.length}`} />
        <p className="theme-muted mt-2 text-xs leading-5">Save changes before leaving a step. Your saved tournament can be resumed from Tournaments.</p>
      </section>

      <FcContextNav
        ariaLabel="Tournament builder steps"
        current="step"
        className="fc-wizard-steps"
        items={steps.map((step, index) => ({
          label: stepLabels[step],
          href: `/tournaments/${tournamentId}/wizard/${stepRoutes[step]}`,
          active: step === currentStep,
          complete: index < currentIndex,
        }))}
      />

      <section className="fc-wizard-content theme-panel border">
        {children}
      </section>
    </div>
  );
}

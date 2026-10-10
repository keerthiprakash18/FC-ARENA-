"use client";

/* eslint-disable react-hooks/exhaustive-deps -- Data-loading effects are intentionally keyed by resource identifiers. */

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  AppShell,
} from "@/components/app/app-shell";

import {
  confirmAction,
  formAction,
} from "@/components/fc/confirmation-provider";

import {
  FcCrest,
  FcEmptyState,
  FcLoadingScreen,
  FcNotice,
} from "@/components/fc/fc-ui";

import {
  TournamentWizardShell,
  type TournamentWizardStep,
} from "@/components/tournaments/tournament-wizard-shell";

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from "@/lib/auth-client";


interface Entry {
  id: string;
  entryName: string | null;
  entryLogoUrl: string | null;
}


interface FixtureRegistration {
  id: string;
  entryName: string | null;
  entryLogoUrl: string | null;
}


interface Fixture {
  id: string;
  roundNumber: number;
  roundName: string;
  matchday: number | null;
  phase: "STAGE" | "PLAYOFF";

  homeRegistration:
    FixtureRegistration |
    null;

  awayRegistration:
    FixtureRegistration |
    null;

  group: {
    id: string;
    name: string;
  } | null;
}


interface PreviewResponse {
  data: {
    tournament: {
      id: string;
      name: string;
      competitionFormat: string;
      fixtureMode: string;
      legType: string;
      groupMode: string;
    };

    fixtures:
      Fixture[];
  };
}


interface EntriesResponse {
  data: {
    entries:
      Entry[];
  };
}


export default function FixturePreviewPage() {
  const {
    tournamentId,
  } =
    useParams<{
      tournamentId:
        string;
    }>();

  const router =
    useRouter();

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    steps,
    setSteps,
  ] =
    useState<TournamentWizardStep[]>(
      [],
    );

  const [
    fixtures,
    setFixtures,
  ] =
    useState<Fixture[]>(
      [],
    );

  const [
    entries,
    setEntries,
  ] =
    useState<Entry[]>(
      [],
    );

  const [
    competitionFormat,
    setCompetitionFormat,
  ] =
    useState("");

  const [
    fixtureMode,
    setFixtureMode,
  ] =
    useState("");

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");


  async function loadPreview() {
    const [
      preview,
      entryResponse,
    ] =
      await Promise.all([
        authenticatedRequest<PreviewResponse>(
          `/tournaments/${tournamentId}/wizard/fixture-preview`,
        ),

        authenticatedRequest<EntriesResponse>(
          `/tournaments/${tournamentId}/entries`,
        ),
      ]);

    setFixtures(
      preview.data.fixtures,
    );

    setCompetitionFormat(
      preview
        .data
        .tournament
        .competitionFormat,
    );

    setFixtureMode(
      preview
        .data
        .tournament
        .fixtureMode,
    );

    setEntries(
      entryResponse
        .data
        .entries,
    );
  }


  useEffect(
    () => {
      async function load() {
        try {
          const [
            current,
            wizard,
          ] =
            await Promise.all([
              getCurrentUser(),

              authenticatedRequest<{
                data: {
                  steps:
                    TournamentWizardStep[];
                };
              }>(
                `/tournaments/${tournamentId}/wizard`,
              ),
            ]);

          setUser(
            current,
          );

          setSteps(
            wizard
              .data
              .steps,
          );

          await loadPreview();
        } catch {
          router.replace(
            "/tournaments",
          );
        }
      }

      void load();
    },
    [
      router,
      tournamentId,
    ],
  );


  const linkedPlayoffTopology =
    competitionFormat ===
      "SINGLE_ELIMINATION" &&
    fixtureMode !==
      "MANUAL";


  const rounds =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            Fixture[]
          >();

        for (
          const fixture
          of fixtures
        ) {
          const key =
            fixture.phase ===
              "PLAYOFF"
              ? fixture.roundName
              : `${fixture.group?.name ?? "Tournament"} · Matchday ${fixture.matchday ?? fixture.roundNumber}`;

          const list =
            map.get(
              key,
            ) ??
            [];

          list.push(
            fixture,
          );

          map.set(
            key,
            list,
          );
        }

        return Array.from(
          map.entries(),
        );
      },
      [
        fixtures,
      ],
    );


  async function regenerate() {
    if (
      !(await confirmAction({
        title:
          "Replace fixture preview?",
        description:
          linkedPlayoffTopology
            ? "Regenerate the linked playoff bracket from the saved Playoff Setup? The current draft bracket will be replaced."
            : "Regenerate the fixture preview? Your current draft changes will be replaced.",
        confirmLabel:
          "Regenerate preview",
        destructive:
          true,
      }))
    ) {
      return;
    }

    setBusy(
      true,
    );
    setError(
      "",
    );
    setMessage(
      "",
    );

    try {
      await authenticatedRequest(
        `/tournaments/${tournamentId}/wizard/fixture-preview/generate`,
        {
          method:
            "POST",
          body:
            JSON.stringify(
              {},
            ),
        },
      );

      setMessage(
        linkedPlayoffTopology
          ? "Playoff bracket regenerated from the saved format."
          : "Fixture preview regenerated.",
      );

      await loadPreview();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to regenerate.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function reset() {
    if (
      !(await confirmAction({
        title:
          "Reset draft fixtures?",
        description:
          "Remove all fixtures from this draft preview? You will need to regenerate or add them again.",
        confirmLabel:
          "Reset draft",
        destructive:
          true,
      }))
    ) {
      return;
    }

    await updateDraft(
      () =>
        authenticatedRequest(
          `/tournaments/${tournamentId}/wizard/fixture-preview`,
          {
            method:
              "DELETE",
          },
        ),
    );
  }


  async function swap(
    fixtureId:
      string,
  ) {
    await updateDraft(
      () =>
        authenticatedRequest(
          `/tournaments/${tournamentId}/wizard/fixture-preview/${fixtureId}/swap`,
          {
            method:
              "POST",
          },
        ),
    );
  }


  async function remove(
    fixtureId:
      string,
  ) {
    if (
      !(await confirmAction({
        title:
          "Delete draft fixture?",
        description:
          "Remove this fixture from the draft preview?",
        confirmLabel:
          "Delete fixture",
        destructive:
          true,
      }))
    ) {
      return;
    }

    await updateDraft(
      () =>
        authenticatedRequest(
          `/tournaments/${tournamentId}/wizard/fixture-preview/${fixtureId}`,
          {
            method:
              "DELETE",
          },
        ),
    );
  }


  async function moveRound(
    fixture:
      Fixture,
  ) {
    const values =
      await formAction({
        title:
          "Move draft fixture",
        description:
          "Choose the matchday for this fixture.",
        confirmLabel:
          "Move fixture",
        fields: [
          {
            name:
              "matchday",
            label:
              "Matchday",
            type:
              "number",
            required:
              true,
            min:
              1,
            step:
              1,
            defaultValue:
              String(
                fixture.matchday ??
                fixture.roundNumber,
              ),
          },
        ],
      });

    const value =
      values
        ?.matchday;

    if (!value) {
      return;
    }

    const matchday =
      Number(
        value,
      );

    if (
      !Number.isInteger(
        matchday,
      ) ||
      matchday <
        1
    ) {
      return;
    }

    await updateDraft(
      () =>
        authenticatedRequest(
          `/tournaments/${tournamentId}/wizard/fixture-preview/${fixture.id}`,
          {
            method:
              "PATCH",
            body:
              JSON.stringify({
                roundNumber:
                  matchday,
                matchday,
              }),
          },
        ),
    );
  }


  async function addMatch() {
    if (
      entries.length <
      2
    ) {
      return;
    }

    const options =
      entries.map(
        (
          entry,
        ) => ({
          value:
            entry.id,
          label:
            entry.entryName ||
            entry.id,
        }),
      );

    const values =
      await formAction({
        title:
          "Add draft fixture",
        description:
          "Select the home and away entries and choose a matchday.",
        confirmLabel:
          "Add fixture",
        fields: [
          {
            name:
              "home",
            label:
              "Home entry",
            type:
              "select",
            required:
              true,
            options,
          },
          {
            name:
              "away",
            label:
              "Away entry",
            type:
              "select",
            required:
              true,
            options,
          },
          {
            name:
              "matchday",
            label:
              "Matchday",
            type:
              "number",
            required:
              true,
            min:
              1,
            step:
              1,
            defaultValue:
              "1",
          },
        ],
        validate:
          (
            values,
          ) =>
            values.home ===
            values.away
              ? "Choose two different entries."
              : undefined,
      });

    if (!values) {
      return;
    }

    await updateDraft(
      () =>
        authenticatedRequest(
          `/tournaments/${tournamentId}/wizard/fixture-preview`,
          {
            method:
              "POST",
            body:
              JSON.stringify({
                homeRegistrationId:
                  values.home.trim(),
                awayRegistrationId:
                  values.away.trim(),
                roundNumber:
                  Number(
                    values.matchday,
                  ),
                matchday:
                  Number(
                    values.matchday,
                  ),
              }),
          },
        ),
    );
  }


  async function updateDraft(
    mutate:
      () =>
        Promise<unknown>,
  ) {
    setBusy(
      true,
    );
    setError(
      "",
    );
    setMessage(
      "",
    );

    try {
      await mutate();
      await loadPreview();

      setMessage(
        "Fixture preview updated.",
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the fixture preview.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function publish() {
    setBusy(
      true,
    );
    setError(
      "",
    );

    try {
      const response =
        await authenticatedRequest<{
          data: {
            nextStep:
              string;
          };
        }>(
          `/tournaments/${tournamentId}/wizard/fixture-preview/publish`,
          {
            method:
              "POST",
          },
        );

      const next =
        response
          .data
          .nextStep;

      router.push(
        next ===
          "REVIEW"
          ? `/tournaments/${tournamentId}/wizard/review`
          : `/tournaments/${tournamentId}/wizard/${next.toLowerCase().replaceAll("_", "-")}`,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to publish fixtures.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  if (
    !user ||
    steps.length ===
      0
  ) {
    return (
      <FcLoadingScreen label="Loading Fixture Preview..." />
    );
  }


  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <TournamentWizardShell
        tournamentId={
          tournamentId
        }
        currentStep="FIXTURE_PREVIEW"
        steps={
          steps
        }
        title={
          linkedPlayoffTopology
            ? "Playoff Bracket Preview"
            : "Fixture Preview"
        }
        description={
          linkedPlayoffTopology
            ? "Review the linked winner/loser progression before publishing. Regenerate the bracket rather than editing individual automatic playoff fixtures."
            : "Review and edit fixtures before they become official."
        }
      >
        <FcNotice>
          {
            message
          }
        </FcNotice>
        <FcNotice tone="error">
          {
            error
          }
        </FcNotice>

        {linkedPlayoffTopology ? (
          <div className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4 text-sm leading-6 text-amber-300">
            Automatic playoff topology is protected because later rounds contain linked winner/loser paths. Use Regenerate or Reset to change the bracket safely.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {!linkedPlayoffTopology ? (
            <button
              type="button"
              disabled={
                busy ||
                entries.length <
                  2
              }
              onClick={() =>
                void addMatch()
              }
              className="rounded-xl border border-[var(--theme-primary)]/20 px-4 py-3 font-black text-[var(--theme-primary)]"
            >
              + Add Match
            </button>
          ) : null}

          <button
            type="button"
            disabled={
              busy
            }
            onClick={() =>
              void regenerate()
            }
            className="theme-secondary-button rounded-xl px-4 py-3 font-black"
          >
            Regenerate
          </button>

          <button
            type="button"
            disabled={
              busy ||
              fixtures.length ===
                0
            }
            onClick={() =>
              void reset()
            }
            className="rounded-xl border border-red-400/20 px-4 py-3 font-black text-red-300 disabled:opacity-40"
          >
            Reset
          </button>
        </div>

        <div className="mt-7 space-y-7">
          {fixtures.length ===
          0 ? (
            <FcEmptyState
              title="No draft fixtures"
              description="Regenerate the preview to create the saved Tournament structure."
              icon="fixtures"
            />
          ) : null}

          {rounds.map(
            ([
              title,
              roundFixtures,
            ]) => (
              <section
                key={
                  title
                }
              >
                <h2 className="text-xl font-black text-[var(--theme-primary)]">
                  {
                    title
                  }
                </h2>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {roundFixtures.map(
                    (
                      fixture,
                    ) => {
                      const home =
                        fixture
                          .homeRegistration;

                      const away =
                        fixture
                          .awayRegistration;

                      return (
                        <article
                          key={
                            fixture.id
                          }
                          className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-secondary-background)] p-4"
                        >
                          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                            <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                              <FcCrest
                                name={
                                  home?.entryName ??
                                  "TBD"
                                }
                                imageUrl={
                                  home?.entryLogoUrl ??
                                  undefined
                                }
                                size="sm"
                              />
                              <p className="theme-text break-words font-black">
                                {
                                  home?.entryName ??
                                  "TBD"
                                }
                              </p>
                            </div>

                            <span className="theme-muted text-xs font-black">
                              VS
                            </span>

                            <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                              <FcCrest
                                name={
                                  away?.entryName ??
                                  "TBD"
                                }
                                imageUrl={
                                  away?.entryLogoUrl ??
                                  undefined
                                }
                                size="sm"
                              />
                              <p className="theme-text break-words font-black">
                                {
                                  away?.entryName ??
                                  "TBD"
                                }
                              </p>
                            </div>
                          </div>

                          {!linkedPlayoffTopology ? (
                            <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-[var(--theme-border)] pt-3">
                              <button
                                type="button"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  void swap(
                                    fixture.id,
                                  )
                                }
                                className="theme-secondary-button rounded-lg px-3 py-2 text-xs font-black"
                              >
                                Swap
                              </button>

                              <button
                                type="button"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  void moveRound(
                                    fixture,
                                  )
                                }
                                className="theme-secondary-button rounded-lg px-3 py-2 text-xs font-black"
                              >
                                Move
                              </button>

                              <button
                                type="button"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  void remove(
                                    fixture.id,
                                  )
                                }
                                className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-black text-red-300"
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </article>
                      );
                    },
                  )}
                </div>
              </section>
            ),
          )}
        </div>

        <div className="fc-workflow-actions mt-8 flex justify-between border-t border-[var(--theme-border)] pt-5">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/tournaments/${tournamentId}/wizard/fixture-settings`,
              )
            }
            className="theme-secondary-button rounded-xl px-5 py-3 font-black"
          >
            ← Back
          </button>

          <button
            type="button"
            disabled={
              busy ||
              fixtures.length ===
                0
            }
            onClick={() =>
              void publish()
            }
            className="theme-primary-button rounded-xl px-6 py-3 font-black disabled:opacity-40"
          >
            {
              busy
                ? "Validating..."
                : "Publish Fixtures & Continue →"
            }
          </button>
        </div>
      </TournamentWizardShell>
    </AppShell>
  );
}

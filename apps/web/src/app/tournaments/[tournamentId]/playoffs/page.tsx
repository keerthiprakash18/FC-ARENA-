"use client";

/* eslint-disable react-hooks/exhaustive-deps -- Data-loading effects are intentionally keyed by tournament id. */

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { PlayoffBracket } from '@/components/tournaments/playoff-bracket';

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  AppShell,
} from "@/components/app/app-shell";

import {
  confirmAction,
} from "@/components/fc/confirmation-provider";

import {
  FcErrorState,
  FcLoadingScreen,
  FcNotice,
} from "@/components/fc/fc-ui";

import {
  PremiumHero,
} from "@/components/fc/premium-ui";

import {
  FixtureCard,
  type FixtureForUi,
} from "@/components/tournaments/fixture-card";

import {
  ApiError,
} from "@/lib/api";

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from "@/lib/auth-client";


type PlayoffFormat =
  | "GLOBAL_SEEDED"
  | "PROTECTED_SEED"
  | "DOUBLE_CHANCE";


interface Tournament {
  id: string;
  name: string;
  code: string;
  competitionFormat: string;
  groupMode: string;
  playoffFormat: PlayoffFormat;
  playoffSource:
    | "AUTO"
    | "DIRECT_ENTRIES"
    | "OVERALL_STANDINGS"
    | "GROUP_QUALIFIERS";
  playoffSeedingBasis:
    | "AUTO"
    | "OVERALL_PERFORMANCE"
    | "GROUP_POSITION"
    | "MANUAL"
    | "RANDOM";
  qualifiersPerGroup: number | null;
  playoffQualifiersTotal: number | null;
  legType: string;
  status: string;
  approvedEntries: number;
  canManageSettings: boolean;
  canManageFixtures: boolean;
  isLeagueAdmin: boolean;
}


type PlayoffFixture =
  FixtureForUi & {
    phase?: "STAGE" | "PLAYOFF";
    group: {
      id: string;
      name: string;
      position: number;
    } | null;
  };


const formatCopy:
  Record<
    PlayoffFormat,
    {
      title: string;
      badge: string;
      description: string;
    }
  > = {
    GLOBAL_SEEDED: {
      title:
        "Global Seeded Knockout",
      badge:
        "STANDARD",
      description:
        "Qualified entries form one seed list. Highest seeds receive available BYEs.",
    },
    PROTECTED_SEED: {
      title:
        "Protected Seed Knockout",
      badge:
        "RECOMMENDED",
      description:
        "Strongest seeds are protected; with multiple groups, leaders are separated across the bracket.",
    },
    DOUBLE_CHANCE: {
      title:
        "Elite Double-Chance",
      badge:
        "PREMIUM",
      description:
        "Elite seeds can survive one qualifying-final loss and enter a second-chance path.",
    },
  };

const roundOf16Format = {
  title: "Round of 16",
  badge: "16 QUALIFIERS",
  description: "The top two teams from each group and the two best third-place teams enter a random, single-leg knockout draw with zero byes.",
};

function usesRoundOf16(tournament: Tournament) {
  return tournament.competitionFormat === "GROUP_STAGE_KNOCKOUT" &&
    tournament.playoffSource === "GROUP_QUALIFIERS" &&
    tournament.playoffFormat === "GLOBAL_SEEDED" &&
    tournament.playoffSeedingBasis === "RANDOM" &&
    tournament.qualifiersPerGroup === 2 && tournament.playoffQualifiersTotal === 16;
}


function displayValue(
  value:
    string,
) {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (
        letter,
      ) =>
        letter.toUpperCase(),
    );
}


export default function PlayoffsPage() {
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
    selectedRound,
    setSelectedRound,
  ] =
    useState(
      "ALL",
    );

  const [
    user,
    setUser,
  ] =
    useState<CurrentUser | null>(
      null,
    );

  const [
    tournament,
    setTournament,
  ] =
    useState<Tournament | null>(
      null,
    );

  const [
    fixtures,
    setFixtures,
  ] =
    useState<PlayoffFixture[]>(
      [],
    );

  const [
    groupCount,
    setGroupCount,
  ] =
    useState(0);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");


  async function loadFixtures(signal?: AbortSignal) {
    const response =
      await authenticatedRequest<{
        data: {
          fixtures:
            PlayoffFixture[];
        };
      }>(
        `/tournaments/${tournamentId}/fixtures`,
        signal ? { signal } : {},
      );

    if (signal?.aborted) return;
    setFixtures(
      response
        .data
        .fixtures,
    );
  }

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    let pending = false;
    const refresh = () => {
      if (pending || navigator.onLine === false || document.visibilityState === 'hidden') return;
      pending = true;
      void loadFixtures(controller.signal).catch(() => undefined).finally(() => { pending = false; });
    };
    const timer = window.setInterval(refresh, 20_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [user?.id, tournamentId]);


  useEffect(
    () => {
      async function load() {
        try {
          const current =
            await getCurrentUser();

          setUser(
            current,
          );

          const [
            tournamentResponse,
            groupResponse,
          ] =
            await Promise.all([
              authenticatedRequest<{
                data: {
                  tournament:
                    Tournament;
                };
              }>(
                `/tournaments/${tournamentId}`,
              ),

              authenticatedRequest<{
                data: {
                  groups:
                    Array<{
                      id:
                        string;
                    }>;
                };
              }>(
                `/tournaments/${tournamentId}/groups`,
              ).catch(
                () => ({
                  data: {
                    groups: [],
                  },
                }),
              ),
            ]);

          setTournament(
            tournamentResponse
              .data
              .tournament,
          );

          setGroupCount(
            groupResponse
              .data
              .groups
              .length,
          );

          await loadFixtures();
        } catch (
          err
        ) {
          if (
            err instanceof
              ApiError &&
            err.status ===
              401
          ) {
            router.replace(
              "/login",
            );
          } else {
            setError(
              "Unable to load playoff details. Please retry.",
            );
          }
        } finally {
          setLoading(
            false,
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


  const stageFixtures =
    useMemo(
      () =>
        fixtures.filter(
          (
            fixture,
          ) =>
            fixture.phase !==
            "PLAYOFF",
        ),
      [
        fixtures,
      ],
    );


  const playoffFixtures =
    useMemo(
      () =>
        fixtures.filter(
          (
            fixture,
          ) =>
            fixture.phase ===
            "PLAYOFF",
        ),
      [
        fixtures,
      ],
    );


  const incompleteStageFixtures =
    stageFixtures.filter(
      (
        fixture,
      ) =>
        fixture.status !==
        "COMPLETED",
    ).length;


  const playoffRounds =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            PlayoffFixture[]
          >();

        for (
          const fixture
          of playoffFixtures
        ) {
          const list =
            map.get(
              fixture.roundName,
            ) ??
            [];

          list.push(
            fixture,
          );

          map.set(
            fixture.roundName,
            list,
          );
        }

        return Array.from(
          map.entries(),
        ).sort(
          (
            [
              ,
              left,
            ],
            [
              ,
              right,
            ],
          ) =>
            (
              left[
                0
              ]
                ?.roundNumber ??
              0
            ) -
            (
              right[
                0
              ]
                ?.roundNumber ??
              0
            ),
        );
      },
      [
        playoffFixtures,
      ],
    );


  const stageRequired =
    tournament
      ?.competitionFormat ===
    "GROUP_STAGE_KNOCKOUT" ||
    tournament
      ?.competitionFormat ===
    "ELITE_CUP" ||
    tournament
      ?.competitionFormat ===
    "UCL_CUP";


  const stageReady =
    !stageRequired ||
    (
      stageFixtures.length >
        0 &&
      incompleteStageFixtures ===
        0
    );


  async function reapplySavedFormat() {
    if (
      busy ||
      !tournament
    ) {
      return;
    }

    const confirmed =
      await confirmAction({
        title:
          "Reapply saved playoff format?",
        description:
          `Reapply ${formatCopy[tournament.playoffFormat].title} to these existing playoff fixtures. Fixture IDs and Match IDs stay unchanged. Real match activity still blocks a bracket rewrite.`,
        confirmLabel:
          "Reapply format",
      });

    if (
      !confirmed
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
      const response =
        await authenticatedRequest<{
          data: {
            message:
              string;
          };
        }>(
          `/tournaments/${tournamentId}/playoffs/reseed`,
          {
            method:
              "POST",
          },
        );

      await loadFixtures();

      setMessage(
        response
          .data
          .message,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update playoffs.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function generatePlayoffs() {
    if (
      !tournament
    ) {
      return;
    }

    if (
      stageRequired &&
      !stageReady
    ) {
      setError(
        stageFixtures.length ===
          0
          ? "Generate the Tournament stage fixtures first."
          : `Complete all stage fixtures first. ${incompleteStageFixtures} match(es) are still incomplete.`,
      );

      return;
    }

    const confirmed =
      await confirmAction({
        title:
          "Generate playoff stage?",
        description:
          usesRoundOf16(tournament)
            ? "Draw the eight Round of 16 matches from the 16 qualified teams?"
            : `Generate ${formatCopy[tournament.playoffFormat].title} using the Playoff Setup saved for this Tournament?`,
        confirmLabel:
          "Generate playoffs",
      });

    if (
      !confirmed
    ) {
      return;
    }

    setBusy(
      true,
    );
    setMessage(
      "",
    );
    setError(
      "",
    );

    try {
      const response =
        await authenticatedRequest<{
          data: {
            message:
              string;
            totalQualifiers:
              number;
            byes:
              number;
            playInMatches:
              number;
            secondChanceMatches:
              number;
            fixtures:
              number;
          };
        }>(
          `/tournaments/${tournamentId}/playoffs/generate`,
          {
            method:
              "POST",
            body:
              JSON.stringify(
                {},
              ),
          },
        );

      setMessage(usesRoundOf16(tournament) ? response.data.message :
        `${response.data.message} ${response.data.totalQualifiers} entries · ${response.data.fixtures} fixtures · ${response.data.byes} BYEs${response.data.secondChanceMatches > 0 ? ` · ${response.data.secondChanceMatches} second-chance matches` : ""}.`);

      await loadFixtures();
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate playoffs.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }

  async function applyRoundOf16() {
    if (!tournament || busy) return;
    const confirmed = await confirmAction({
      title: "Use the Round of 16 format?",
      description: playoffFixtures.length
        ? "Replace the current unplayed playoff bracket with a 16-team random draw. This replaces its fixture links."
        : "Advance each group’s top two teams plus the two best third-place teams. The draw uses confirmed group-stage results.",
      confirmLabel: "Apply Round of 16",
    });
    if (!confirmed) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await authenticatedRequest<{ data: { message: string } }>(
        `/tournaments/${tournamentId}/playoffs/best-third-round-of-16`,
        { method: "POST" },
      );
      setTournament({
        ...tournament, qualifiersPerGroup: 2, playoffQualifiersTotal: 16,
        playoffSource: "GROUP_QUALIFIERS", playoffFormat: "GLOBAL_SEEDED", playoffSeedingBasis: "RANDOM",
      });
      setSelectedRound("ALL");
      setMessage(response.data.message);
      await loadFixtures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to apply the Round of 16 format.");
    } finally {
      setBusy(false);
    }
  }


  if (
    !loading &&
    (
      !user ||
      !tournament
    ) &&
    error
  ) {
    return (
      <AppShell>
        <FcErrorState
          message={
            error
          }
          onRetry={() =>
            window.location.reload()
          }
        />
      </AppShell>
    );
  }


  if (
    loading ||
    !user ||
    !tournament
  ) {
    return (
      <FcLoadingScreen label="Loading Playoff Center..." />
    );
  }


  const roundOf16 = usesRoundOf16(tournament);
  const format = roundOf16 ? roundOf16Format : formatCopy[tournament.playoffFormat];
  const canApplyRoundOf16 = !roundOf16 && tournament.canManageSettings && tournament.canManageFixtures &&
    tournament.competitionFormat === "GROUP_STAGE_KNOCKOUT" && tournament.legType === "SINGLE_LEG" &&
    ["DRAFT", "REGISTRATION_CLOSED", "ACTIVE"].includes(tournament.status) &&
    groupCount === 7 && tournament.approvedEntries === 42 &&
    playoffFixtures.every(fixture => fixture.status === "UNSCHEDULED" && !fixture.scheduledAt);


  const canReapply =
    tournament.isLeagueAdmin &&
    playoffFixtures.length >
      0 &&
    tournament.playoffSeedingBasis !==
      "RANDOM" &&
    playoffFixtures.every(
      (
        fixture,
      ) =>
        fixture.status ===
        "UNSCHEDULED",
    );


  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <div className="premium-page premium-playoffs">
        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="theme-muted text-sm font-black hover:text-[var(--theme-text)]"
        >
          ← Back
        </button>

        <PremiumHero
          eyebrow={
            `${tournament.name} · ${format.title}`
          }
          title="Playoff Center"
          description={
            format.description
          }
          crest={
            tournament.name
          }
        >
          <div className="premium-hero-tags">
            <span>
              {
                tournament.code
              }
            </span>
            <span>
              {
                format.badge
              }
            </span>
            <span>
              {
                playoffFixtures.length
              } playoff fixtures
            </span>
            {stageRequired ? (
              <span>
                {
                  incompleteStageFixtures
                } stage matches remaining
              </span>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {groupCount >
            0 ? (
              <Link
                href={
                  `/tournaments/${tournamentId}/groups`
                }
                className="theme-secondary-button premium-button"
              >
                Groups
              </Link>
            ) : null}

            <Link
              href={
                `/tournaments/${tournamentId}/standings`
              }
              className="theme-secondary-button premium-button"
            >
              Standings
            </Link>

            <Link
              href={
                `/tournaments/${tournamentId}/fixtures`
              }
              className="theme-secondary-button premium-button"
            >
              Fixtures
            </Link>

            <Link
              href={
                `/tournaments/${tournamentId}/achievements`
              }
              className="theme-secondary-button premium-button"
            >
              Hall of Champions
            </Link>
          </div>
        </PremiumHero>

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

        <section
          className="premium-metrics premium-standing-metrics"
          aria-label="Playoff progress"
        >
          {[
            [
              "Format",
              format.badge,
            ],
            [
              "Stage Matches",
              stageFixtures.length,
            ],
            [
              "Remaining",
              incompleteStageFixtures,
            ],
            [
              "Playoff Fixtures",
              playoffFixtures.length,
            ],
          ].map(
            ([
              label,
              value,
            ]) => (
              <article
                key={
                  label
                }
                className="theme-card rounded-2xl border p-5"
              >
                <p className="theme-muted text-xs">
                  {
                    label
                  }
                </p>
                <p className="theme-text mt-2 text-2xl font-black">
                  {
                    value
                  }
                </p>
              </article>
            ),
          )}
        </section>

        <section className="theme-card rounded-2xl border p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--theme-primary)]">
                Saved Playoff Setup
              </p>
              <h2 className="theme-text mt-1 text-xl font-black">
                {
                  format.title
                }
              </h2>
              <p className="theme-muted mt-2 text-sm">
                {
                  displayValue(
                    tournament.playoffSource,
                  )
                } · {
                  displayValue(
                    tournament.playoffSeedingBasis,
                  )
                }
                {roundOf16 ? " · Top 2 / group + 2 best third-place teams" : tournament.qualifiersPerGroup
                  ? ` · Top ${tournament.qualifiersPerGroup} / group`
                  : tournament.playoffQualifiersTotal
                    ? ` · ${tournament.playoffQualifiersTotal} entries`
                    : ""}
              </p>
            </div>

            {canReapply ? (
              <button
                className="theme-primary-button min-h-11 rounded-xl px-4 font-black"
                disabled={
                  busy
                }
                onClick={() =>
                  void reapplySavedFormat()
                }
              >
                {
                  busy
                    ? "Updating playoffs…"
                    : "Reapply Saved Format"
                }
              </button>
            ) : null}
          </div>
          {canApplyRoundOf16 ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--theme-border)] pt-4">
              <div>
                <h3 className="theme-text font-semibold">Round of 16 with best third-place teams</h3>
                <p className="theme-muted mt-1 text-sm">Seven group winners, seven runners-up and two third-place teams. Eight opening matches and zero byes.</p>
              </div>
              <button type="button" className="theme-primary-button min-h-11 rounded-xl px-4 font-semibold"
                disabled={busy} onClick={() => void applyRoundOf16()}>
                Apply Round of 16
              </button>
            </div>
          ) : null}
        </section>

        {playoffFixtures.length ===
        0 ? (
          <section
            className={
              "rounded-2xl border p-6 " +
              (
                stageReady
                  ? "border-emerald-400/20 bg-emerald-400/[0.04]"
                  : "border-amber-400/20 bg-amber-400/[0.04]"
              )
            }
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--theme-primary)]">
              Ready Check
            </p>
            <h2 className="theme-text mt-2 text-2xl font-black">
              {
                stageReady
                  ? "Ready to Generate Playoffs"
                  : "Tournament Stage Not Finished"
              }
            </h2>
            <p className="theme-secondary-text mt-3 max-w-2xl text-sm leading-6">
              {
                stageReady
                  ? `${format.title} will use the saved qualification and seeding rules. SOLO, DUO and TEAM entries all use the same universal bracket engine.`
                  : stageFixtures.length ===
                      0
                    ? "Generate the stage schedule first. Playoffs can only be created after a Stage + Playoffs tournament has real stage fixtures."
                    : `${incompleteStageFixtures} stage fixture(s) must be completed first.`
              }
            </p>

            {tournament.isLeagueAdmin ? (
              <button
                type="button"
                disabled={
                  busy ||
                  !stageReady
                }
                onClick={() =>
                  void generatePlayoffs()
                }
                className="theme-primary-button mt-5 rounded-xl px-5 py-3 font-black disabled:opacity-40"
              >
                {
                  busy
                    ? "Generating Playoffs..."
                    : "Generate Saved Playoff Format"
                }
              </button>
            ) : null}
          </section>
        ) : (
          <section className="space-y-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--theme-primary)]">
                Playoff Bracket
              </p>
              <h2 className="theme-text mt-2 text-3xl font-black">
                Road to the Final
              </h2>
              {tournament.playoffFormat ===
              "DOUBLE_CHANCE" ? (
                <p className="theme-muted mt-2 text-sm">
                  Qualifying-final losers automatically drop into the Second Chance path. Lower-path losses eliminate the entry.
                </p>
              ) : null}
            </div>

            <PlayoffBracket fixtures={playoffFixtures} tournamentName={tournament.name} format={tournament.competitionFormat === 'UCL_CUP' ? 'UCL_CUP' : tournament.playoffFormat} />

            <div className="premium-bracket-controls">
              <label className="fc-field-label">
                Playoff round
                <select
                  value={
                    selectedRound
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setSelectedRound(
                        event.target.value,
                      )
                  }
                  className="theme-secondary-button rounded-xl p-3"
                >
                  <option value="ALL">
                    All rounds
                  </option>
                  {playoffRounds.map(
                    ([
                      name,
                    ]) => (
                      <option
                        key={
                          name
                        }
                        value={
                          name
                        }
                      >
                        {
                          name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <p className="premium-bracket-hint theme-muted text-xs">
                Swipe across rounds on mobile. Winner/loser source labels stay visible for linked Double-Chance fixtures.
              </p>
            </div>

            <div
              className="premium-bracket"
              role="region"
              aria-label="Playoff bracket"
              tabIndex={
                0
              }
            >
              {playoffRounds
                .filter(
                  ([
                    name,
                  ]) =>
                    selectedRound ===
                      "ALL" ||
                    name ===
                      selectedRound,
                )
                .map(
                  ([
                    roundName,
                    roundFixtures,
                  ]) => (
                    <article
                      key={
                        roundName
                      }
                      className="fc-bracket-round theme-card rounded-[26px] border p-5 md:p-6"
                      aria-label={
                        `${roundName} bracket`
                      }
                    >
                      <div className="premium-bracket-round-head flex items-center justify-between">
                        <h3 className="theme-text text-2xl font-black">
                          {
                            roundName
                          }
                        </h3>

                        <span className="rounded-full bg-[var(--theme-primary-soft)] px-3 py-2 text-xs font-black text-[var(--theme-primary)]">
                          {
                            roundFixtures.length
                          } Match{
                            roundFixtures.length ===
                            1
                              ? ""
                              : "es"
                          }
                        </span>
                      </div>

                      <div className="premium-bracket-matches mt-5 grid gap-4">
                        {[
                          ...roundFixtures,
                        ]
                          .sort(
                            (
                              left,
                              right,
                            ) =>
                              left.bracketPosition -
                              right.bracketPosition,
                          )
                          .map(
                            (
                              fixture,
                            ) => (
                              <FixtureCard
                                key={
                                  fixture.id
                                }
                                fixture={
                                  fixture
                                }
                                isAdmin={
                                  tournament.isLeagueAdmin
                                }
                                onChanged={
                                  loadFixtures
                                }
                              />
                            ),
                          )}
                      </div>
                    </article>
                  ),
                )}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

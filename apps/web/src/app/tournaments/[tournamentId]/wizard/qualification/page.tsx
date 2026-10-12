"use client";

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


type PlayoffFormat =
  | "GLOBAL_SEEDED"
  | "PROTECTED_SEED"
  | "DOUBLE_CHANCE";

type PlayoffSource =
  | "AUTO"
  | "DIRECT_ENTRIES"
  | "OVERALL_STANDINGS"
  | "GROUP_QUALIFIERS";

type SeedingBasis =
  | "AUTO"
  | "OVERALL_PERFORMANCE"
  | "GROUP_POSITION"
  | "MANUAL"
  | "RANDOM";


interface WizardResponse {
  data: {
    steps: TournamentWizardStep[];
    configuration: {
      competitionFormat: string;
      groupMode: string;
      qualifiersPerGroup: number | null;
      playoffFormat: PlayoffFormat;
      playoffSource: PlayoffSource;
      playoffSeedingBasis: SeedingBasis;
      playoffQualifiersTotal: number | null;
      avoidSameGroupEarly: boolean;
    };
  };
}


interface Entry {
  id: string;
  status: string;
}


interface Group {
  id: string;
  name: string;
  entries: Entry[];
}


interface GroupsResponse {
  data: {
    groups: Group[];
  };
}


interface EntriesResponse {
  data: {
    entries: Entry[];
  };
}


const formats: Array<{
  value: PlayoffFormat;
  title: string;
  badge: string;
  description: string;
  bullets: string[];
}> = [
  {
    value: "GLOBAL_SEEDED",
    title: "Global Seeded Knockout",
    badge: "STANDARD",
    description:
      "Rank the qualified entries as one seed list. The strongest seeds receive any available byes.",
    bullets: [
      "Simple seeded bracket",
      "Best overall seeds protected by BYEs",
      "Works with no groups, one table or many groups",
    ],
  },
  {
    value: "PROTECTED_SEED",
    title: "Protected Seed Knockout",
    badge: "RECOMMENDED",
    description:
      "Protect the strongest seeds and, with multiple groups, keep group leaders on separated bracket paths.",
    bullets: [
      "Top-seed / Top-2 advantage",
      "Cross-group protection when groups exist",
      "Best balance of reward and fairness",
    ],
  },
  {
    value: "DOUBLE_CHANCE",
    title: "Elite Double-Chance",
    badge: "PREMIUM",
    description:
      "Elite seeds enter a qualifying-final path. A first loss sends them into a second-chance match instead of immediate elimination.",
    bullets: [
      "Top seeds get a second life",
      "Lower seeds play elimination paths",
      "Winner and loser progression is tracked automatically",
    ],
  },
];


function nextPowerOfTwo(value: number) {
  if (value <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(value));
}


function previewMetrics(
  format: PlayoffFormat,
  qualifiers: number,
) {
  const safe =
    Math.max(
      2,
      qualifiers,
    );

  const bracketSize =
    nextPowerOfTwo(
      safe,
    );

  const byes =
    format ===
    "DOUBLE_CHANCE"
      ? safe >= 8
        ? 4
        : 2
      : bracketSize -
        safe;

  const fixtures =
    format ===
    "DOUBLE_CHANCE"
      ? safe >= 8
        ? safe + 1
        : safe
      : safe - 1;

  const secondChance =
    format ===
    "DOUBLE_CHANCE"
      ? safe >= 8
        ? 2
        : 1
      : 0;

  return {
    bracketSize,
    byes,
    fixtures,
    secondChance,
  };
}


function MiniBracket({
  format,
}: {
  format: PlayoffFormat;
}) {
  if (
    format ===
    "DOUBLE_CHANCE"
  ) {
    return (
      <div className="grid gap-2 text-[10px] font-bold sm:grid-cols-3">
        <div className="space-y-2">
          <div className="theme-soft-accent rounded-lg border p-2">Lower Seeds · Elimination</div>
          <div className="theme-soft-accent rounded-lg border p-2">Elite Seed 1 vs Elite Seed 4</div>
          <div className="theme-soft-accent rounded-lg border p-2">Elite Seed 2 vs Elite Seed 3</div>
        </div>
        <div className="space-y-2">
          <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-2 text-amber-300">
            Qualifying losers → Second Chance
          </div>
          <div className="theme-soft-accent rounded-lg border p-2">Semi Final</div>
        </div>
        <div className="flex items-center">
          <div className="w-full rounded-lg border border-[var(--theme-primary)]/30 bg-[var(--theme-primary-soft)] p-3 text-center">
            🏆 Final
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 text-[10px] font-bold sm:grid-cols-3">
      <div className="space-y-2">
        <div className="theme-soft-accent rounded-lg border p-2">Play-in / Round 1</div>
        <div className="theme-soft-accent rounded-lg border p-2">
          {format === "PROTECTED_SEED" ? "Protected Top Seeds · BYE" : "Highest Seeds · BYE"}
        </div>
      </div>
      <div className="flex items-center">
        <div className="theme-soft-accent w-full rounded-lg border p-2 text-center">Quarter / Semi</div>
      </div>
      <div className="flex items-center">
        <div className="w-full rounded-lg border border-[var(--theme-primary)]/30 bg-[var(--theme-primary-soft)] p-3 text-center">
          🏆 Final
        </div>
      </div>
    </div>
  );
}


export default function QualificationPage() {
  const {
    tournamentId,
  } = useParams<{
    tournamentId: string;
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
    competitionFormat,
    setCompetitionFormat,
  ] =
    useState("");

  const [
    groupMode,
    setGroupMode,
  ] =
    useState("");

  const [
    groupCount,
    setGroupCount,
  ] =
    useState(0);

  const [
    approvedEntries,
    setApprovedEntries,
  ] =
    useState(0);

  const [
    format,
    setFormat,
  ] =
    useState<PlayoffFormat>(
      "PROTECTED_SEED",
    );

  const [
    source,
    setSource,
  ] =
    useState<PlayoffSource>(
      "AUTO",
    );

  const [
    seeding,
    setSeeding,
  ] =
    useState<SeedingBasis>(
      "AUTO",
    );

  const [
    qualifiersPerGroup,
    setQualifiersPerGroup,
  ] =
    useState(2);

  const [
    qualifierTotal,
    setQualifierTotal,
  ] =
    useState(8);

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


  useEffect(() => {
    async function load() {
      const [
        current,
        wizard,
        entries,
        groups,
      ] = await Promise.all([
        getCurrentUser(),
        authenticatedRequest<WizardResponse>(
          `/tournaments/${tournamentId}/wizard`,
        ),
        authenticatedRequest<EntriesResponse>(
          `/tournaments/${tournamentId}/entries`,
        ),
        authenticatedRequest<GroupsResponse>(
          `/tournaments/${tournamentId}/groups`,
        ).catch(
          () => ({
            data: {
              groups: [],
            },
          }),
        ),
      ]);

      const config =
        wizard.data.configuration;

      const approved =
        entries.data.entries.filter(
          (
            entry,
          ) =>
            entry.status ===
            "APPROVED",
        ).length;

      setUser(
        current,
      );
      setSteps(
        wizard.data.steps,
      );
      setCompetitionFormat(
        config.competitionFormat,
      );
      setGroupMode(
        config.groupMode,
      );
      setGroupCount(
        groups.data.groups.length,
      );
      setApprovedEntries(
        approved,
      );
      setFormat(
        config.playoffFormat ??
        "PROTECTED_SEED",
      );
      setSource(
        config.playoffSource ??
        "AUTO",
      );
      setSeeding(
        config.playoffSeedingBasis ??
        "AUTO",
      );
      setQualifiersPerGroup(
        config.qualifiersPerGroup ??
        2,
      );
      setQualifierTotal(
        config.playoffQualifiersTotal ??
        Math.max(
          2,
          approved,
        ),
      );
    }

    void load().catch(
      (
        err,
      ) =>
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load playoff setup.",
        ),
    );
  }, [
    tournamentId,
  ]);


  const resolvedSource =
    useMemo<Exclude<PlayoffSource, "AUTO">>(
      () => {
        if (
          source !==
          "AUTO"
        ) {
          return source;
        }

        if (
          competitionFormat ===
          "SINGLE_ELIMINATION"
        ) {
          return "DIRECT_ENTRIES";
        }

        if (
          groupMode ===
            "MULTIPLE_GROUPS" &&
          groupCount >
            1
        ) {
          return "GROUP_QUALIFIERS";
        }

        return "OVERALL_STANDINGS";
      },
      [
        competitionFormat,
        groupCount,
        groupMode,
        source,
      ],
    );


  const totalQualifiers =
    resolvedSource ===
    "GROUP_QUALIFIERS"
      ? groupCount *
        qualifiersPerGroup
      : Math.min(
          approvedEntries,
          qualifierTotal,
        );


  const metrics =
    previewMetrics(
      format,
      Math.max(
        2,
        totalQualifiers,
      ),
    );


  const sourceOptions =
    [
      {
        value: "AUTO" as const,
        label: "Auto",
        description: "FC ARENA chooses the correct source for this Tournament structure.",
        disabled: false,
      },
      {
        value: "GROUP_QUALIFIERS" as const,
        label: "Group Qualifiers",
        description: "Take Top N entries from each group.",
        disabled: groupCount < 2,
      },
      {
        value: "OVERALL_STANDINGS" as const,
        label: "Overall Standings",
        description: "Choose the best entries from one combined stage table.",
        disabled: competitionFormat === "SINGLE_ELIMINATION",
      },
      {
        value: "DIRECT_ENTRIES" as const,
        label: "Direct Entries",
        description: "Seed approved entries directly without a stage table.",
        disabled: competitionFormat !== "SINGLE_ELIMINATION",
      },
    ];


  async function save() {
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
        `/tournaments/${tournamentId}/wizard/qualification`,
        {
          method:
            "PATCH",
          body:
            JSON.stringify({
              playoffFormat:
                format,
              playoffSource:
                source,
              playoffSeedingBasis:
                seeding,
              qualifiersPerGroup:
                resolvedSource ===
                "GROUP_QUALIFIERS"
                  ? qualifiersPerGroup
                  : undefined,
              playoffQualifiersTotal:
                resolvedSource !==
                "GROUP_QUALIFIERS"
                  ? qualifierTotal
                  : undefined,
              avoidSameGroupEarly:
                true,
            }),
        },
      );

      setMessage(
        "Playoff setup saved.",
      );

      router.push(
        `/tournaments/${tournamentId}/wizard/fixture-settings`,
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save playoff setup.",
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
      <FcLoadingScreen label="Loading Playoff Setup..." />
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
        currentStep="QUALIFICATION"
        steps={
          steps
        }
        title="Playoff Setup"
        description="Choose how qualified entries reach the title. The same engine works for SOLO, DUO and TEAM tournaments with no groups, one table or multiple groups."
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

        <section>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--theme-primary)]">
            1 · Playoff Format
          </p>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {formats.map(
              (
                option,
              ) => {
                const selected =
                  format ===
                  option.value;

                return (
                  <button
                    key={
                      option.value
                    }
                    type="button"
                    aria-pressed={
                      selected
                    }
                    onClick={() =>
                      setFormat(
                        option.value,
                      )
                    }
                    className={
                      "rounded-2xl border p-5 text-left transition " +
                      (
                        selected
                          ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]"
                          : "border-[var(--theme-border)] bg-[var(--theme-secondary-background)] hover:border-[var(--theme-primary)]/40"
                      )
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="theme-text text-lg font-black">
                          {
                            option.title
                          }
                        </p>
                        <p className="theme-secondary-text mt-2 text-sm leading-6">
                          {
                            option.description
                          }
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-[var(--theme-primary)]/25 bg-[var(--theme-primary-soft)] px-2 py-1 text-[9px] font-black text-[var(--theme-primary)]">
                        {
                          option.badge
                        }
                      </span>
                    </div>

                    <div className="mt-4">
                      <MiniBracket
                        format={
                          option.value
                        }
                      />
                    </div>

                    <ul className="theme-muted mt-4 space-y-1 text-xs">
                      {option.bullets.map(
                        (
                          bullet,
                        ) => (
                          <li
                            key={
                              bullet
                            }
                          >
                            ✓ {
                              bullet
                            }
                          </li>
                        ),
                      )}
                    </ul>
                  </button>
                );
              },
            )}
          </div>
        </section>

        <section className="mt-8 border-t border-[var(--theme-border)] pt-7">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--theme-primary)]">
            2 · Qualification Source
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {sourceOptions.map(
              (
                option,
              ) => (
                <button
                  key={
                    option.value
                  }
                  type="button"
                  disabled={
                    option.disabled
                  }
                  aria-pressed={
                    source ===
                    option.value
                  }
                  onClick={() =>
                    setSource(
                      option.value,
                    )
                  }
                  className={
                    "rounded-xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-35 " +
                    (
                      source ===
                      option.value
                        ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]"
                        : "border-[var(--theme-border)]"
                    )
                  }
                >
                  <p className="theme-text font-black">
                    {
                      option.label
                    }
                  </p>
                  <p className="theme-muted mt-1 text-xs leading-5">
                    {
                      option.description
                    }
                  </p>
                </button>
              ),
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {resolvedSource ===
            "GROUP_QUALIFIERS" ? (
              <label className="field">
                <span>
                  Qualifiers per Group
                </span>
                <input
                  type="number"
                  min="1"
                  max="64"
                  value={
                    qualifiersPerGroup
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setQualifiersPerGroup(
                        Math.max(
                          1,
                          Number(
                            event.target.value,
                          ),
                        ),
                      )
                  }
                />
              </label>
            ) : (
              <label className="field">
                <span>
                  Total Playoff Entries
                </span>
                <input
                  type="number"
                  min="2"
                  max={
                    Math.max(
                      2,
                      approvedEntries,
                    )
                  }
                  value={
                    qualifierTotal
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setQualifierTotal(
                        Math.max(
                          2,
                          Number(
                            event.target.value,
                          ),
                        ),
                      )
                  }
                />
              </label>
            )}

            <label className="field">
              <span>
                Seeding Basis
              </span>
              <select
                value={
                  seeding
                }
                onChange={
                  (
                    event,
                  ) =>
                    setSeeding(
                      event.target.value as SeedingBasis,
                    )
                }
              >
                <option value="AUTO">
                  Auto
                </option>
                <option value="OVERALL_PERFORMANCE">
                  Overall Performance
                </option>
                {groupCount >
                1 ? (
                  <option value="GROUP_POSITION">
                    Group Position
                  </option>
                ) : null}
                <option value="MANUAL">
                  Manual Entry Order
                </option>
                <option value="RANDOM">
                  Random Draw
                </option>
              </select>
            </label>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-[var(--theme-primary)]/20 bg-[var(--theme-primary-soft)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--theme-primary)]">
                Live Preview
              </p>
              <h2 className="theme-text mt-2 text-2xl font-black">
                {
                  formats.find(
                    (
                      item,
                    ) =>
                      item.value ===
                      format,
                  )?.title
                }
              </h2>
              <p className="theme-muted mt-2 text-sm">
                Source: {
                  resolvedSource.replaceAll(
                    "_",
                    " ",
                  )
                } · {
                  totalQualifiers
                } qualified entries
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {[
                [
                  "Entries",
                  totalQualifiers,
                ],
                [
                  "BYEs",
                  metrics.byes,
                ],
                [
                  "Fixtures",
                  metrics.fixtures,
                ],
                [
                  "2nd Chance",
                  metrics.secondChance,
                ],
              ].map(
                ([
                  label,
                  value,
                ]) => (
                  <div
                    key={
                      label
                    }
                    className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2"
                  >
                    <p className="theme-muted text-[9px] font-bold uppercase">
                      {
                        label
                      }
                    </p>
                    <p className="theme-text mt-1 text-lg font-black">
                      {
                        value
                      }
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="mt-5">
            <MiniBracket
              format={
                format
              }
            />
          </div>
        </section>

        <div className="fc-workflow-actions mt-8 flex justify-between border-t border-[var(--theme-border)] pt-5">
          <button
            type="button"
            disabled={
              busy
            }
            onClick={() =>
              router.back()
            }
            className="theme-secondary-button rounded-xl px-5 py-3 font-black"
          >
            ← Back
          </button>

          <button
            type="button"
            disabled={
              busy ||
              totalQualifiers <
                (
                  format ===
                  "DOUBLE_CHANCE"
                    ? 3
                    : 2
                )
            }
            onClick={() =>
              void save()
            }
            className="theme-primary-button rounded-xl px-6 py-3 font-black disabled:opacity-40"
          >
            {
              busy
                ? "Saving..."
                : "Save Playoff Setup →"
            }
          </button>
        </div>
      </TournamentWizardShell>
    </AppShell>
  );
}

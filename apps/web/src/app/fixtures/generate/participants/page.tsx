'use client';

import {
  useRouter,
} from 'next/navigation';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  FixtureGeneratorShell,
} from '@/components/fixtures/fixture-generator-shell';

import {
  FcCrest,
  FcLoadingScreen,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import {
  authenticatedRequest,
  getCurrentUser,
  type CurrentUser,
} from '@/lib/auth-client';

import {
  loadFixtureGeneratorDraft,
  saveFixtureGeneratorDraft,
  type FixtureGeneratorDraft,
  type FixtureParticipantMeta,
} from '@/lib/fixture-generator-draft';


interface ExistingEntry {
  id: string;
  entryName: string | null;
  entryLogoUrl: string | null;
  groupId: string | null;
  status: string;
}


interface LeagueTeamCandidate {
  key: string;
  name: string;
  logoUrl: string | null;
}


interface LeagueMember {
  membershipId: string;

  user: {
    id: string;
    fullName: string;
    playerCode: string | null;
    inGameName: string | null;
  };
}


interface Group {
  id: string;
  name: string;

  entries: ExistingEntry[];
}


interface ParticipantRow {
  key: string;
  registrationId: string | null;
  name: string;
  shortName: string;
  logoUrl: string;
  groupId: string | null;

  source:
    | 'MANUAL'
    | 'TOURNAMENT'
    | 'LEAGUE';
}


function blankRow(
  index:
    number,
): ParticipantRow {
  return {
    key:
      `participant-${Date.now()}-${index}-${Math.random()}`,
    registrationId:
      null,
    name:
      '',
    shortName:
      '',
    logoUrl:
      '',
    groupId:
      null,
    source:
      'MANUAL',
  };
}


function toRows(
  draft:
    FixtureGeneratorDraft,
) {
  const rows:
    ParticipantRow[] =
    draft.participants.map(
      (
        participant,
        index,
      ) => ({
        key:
          `saved-${participant.registrationId}-${index}`,
        registrationId:
          participant.registrationId,
        name:
          participant.name,
        shortName:
          participant.shortName ??
          '',
        logoUrl:
          participant.logoUrl ??
          '',
        groupId:
          draft.groupId,
        source:
          participant.source,
      }),
    );

  while (
    rows.length <
    draft.participantCount
  ) {
    rows.push(
      blankRow(
        rows.length,
      ),
    );
  }

  return rows.slice(
    0,
    draft.participantCount,
  );
}


async function imageToDataUrl(
  file:
    File,
) {
  if (
    ![
      'image/png',
      'image/jpeg',
      'image/webp',
    ].includes(
      file.type,
    )
  ) {
    throw new Error(
      'Use PNG, JPEG or WEBP for team crests.',
    );
  }

  if (
    file.size >
    500_000
  ) {
    throw new Error(
      'Team crest must be 500 KB or smaller.',
    );
  }

  return new Promise<string>(
    (
      resolve,
      reject,
    ) => {
      const reader =
        new FileReader();

      reader.onload =
        () =>
          resolve(
            String(
              reader.result,
            ),
          );

      reader.onerror =
        () =>
          reject(
            new Error(
              'Unable to read crest image.',
            ),
          );

      reader.readAsDataURL(
        file,
      );
    },
  );
}


export default function FixtureParticipantsPage() {
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
    draft,
    setDraft,
  ] =
    useState<FixtureGeneratorDraft>(
      () =>
        loadFixtureGeneratorDraft(),
    );

  const [
    rows,
    setRows,
  ] =
    useState<ParticipantRow[]>(
      () =>
        toRows(
          loadFixtureGeneratorDraft(),
        ),
    );

  const [
    entries,
    setEntries,
  ] =
    useState<ExistingEntry[]>(
      [],
    );

  const [
    leagueMembers,
    setLeagueMembers,
  ] =
    useState<LeagueMember[]>(
      [],
    );

  const [
    leagueTeams,
    setLeagueTeams,
  ] =
    useState<LeagueTeamCandidate[]>(
      [],
    );

  const [
    groups,
    setGroups,
  ] =
    useState<Group[]>(
      [],
    );

  const [
    inputMode,
    setInputMode,
  ] =
    useState<
      'MANUAL'
      | 'IMPORT'
    >(
      'MANUAL',
    );

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');


  useEffect(() => {
    if (
      !draft.tournamentId ||
      !draft.leagueId
    ) {
      router.replace(
        '/fixtures/generate',
      );

      return;
    }

    void (async () => {
      try {
        const [
          current,
          entryResponse,
          groupResponse,
          memberResponse,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<any>(
              `/tournaments/${draft.tournamentId}/entries`,
            ),

            authenticatedRequest<any>(
              `/tournaments/${draft.tournamentId}/groups`,
            ).catch(
              () => ({
                data: {
                  groups: [],
                },
              }),
            ),

            authenticatedRequest<any>(
              `/leagues/${draft.leagueId}/members`,
            ).catch(
              () => ({
                data: {
                  members: [],
                },
              }),
            ),
          ]);

        setUser(
          current,
        );

        const loadedEntries:
          ExistingEntry[] =
          entryResponse
            .data
            .entries
            .filter(
              (
                entry:
                  ExistingEntry,
              ) =>
                entry.status ===
                'APPROVED',
            );

        setEntries(
          loadedEntries,
        );

        const loadedGroups:
          Group[] =
          groupResponse
            .data
            .groups ??
          [];

        setGroups(
          loadedGroups,
        );

        setLeagueMembers(
          memberResponse
            .data
            .members ??
            [],
        );


        // League-wide team import is derived from existing Tournament entries,
        // because FC ARENA currently has no separate persistent League Team model.
        try {
          const tournamentResponse =
            await authenticatedRequest<any>(
              `/leagues/${draft.leagueId}/tournaments`,
            );

          const leagueTournaments:
            Array<{
              id: string;
            }> =
            tournamentResponse
              .data
              .tournaments ??
            [];

          const entryGroups =
            await Promise.all(
              leagueTournaments
                .filter(
                  (
                    tournament,
                  ) =>
                    tournament.id !==
                    draft.tournamentId,
                )
                .map(
                  async (
                    tournament,
                  ) => {
                    try {
                      const response =
                        await authenticatedRequest<any>(
                          `/tournaments/${tournament.id}/entries`,
                        );

                      return (
                        response
                          .data
                          .entries as ExistingEntry[]
                      ).filter(
                        (
                          entry,
                        ) =>
                          entry.status ===
                          'APPROVED',
                      );
                    } catch {
                      return [];
                    }
                  },
                ),
            );

          const unique =
            new Map<
              string,
              LeagueTeamCandidate
            >();

          for (
            const entry
            of entryGroups.flat()
          ) {
            const name =
              entry.entryName
                ?.trim();

            if (!name) {
              continue;
            }

            const normalized =
              name.toLocaleLowerCase();

            if (
              unique.has(
                normalized,
              )
            ) {
              continue;
            }

            unique.set(
              normalized,
              {
                key:
                  `league-team-${entry.id}`,
                name,
                logoUrl:
                  entry.entryLogoUrl,
              },
            );
          }

          setLeagueTeams(
            Array.from(
              unique.values(),
            ),
          );
        } catch {
          setLeagueTeams(
            [],
          );
        }

        if (
          draft.participants.length >
          0
        ) {
          setRows(
            (
              currentRows,
            ) =>
              currentRows.map(
                (
                  row,
                ) => {
                  if (
                    !row.registrationId
                  ) {
                    return row;
                  }

                  const existing =
                    loadedEntries.find(
                      (
                        entry,
                      ) =>
                        entry.id ===
                        row.registrationId,
                    );

                  if (
                    !existing
                  ) {
                    return row;
                  }

                  return {
                    ...row,
                    groupId:
                      existing.groupId,
                    logoUrl:
                      existing.entryLogoUrl ??
                      row.logoUrl,
                  };
                },
              ),
          );
        }
      } catch (
        err
      ) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load participants.',
        );
      }
    })();
  }, [
    draft.leagueId,
    draft.tournamentId,
    router,
  ]);


  const selectedIds =
    useMemo(
      () =>
        new Set(
          rows
            .map(
              (
                row,
              ) =>
                row.registrationId,
            )
            .filter(
              (
                value,
              ): value is string =>
                Boolean(
                  value,
                ),
            ),
        ),
      [
        rows,
      ],
    );


  function updateRow(
    index:
      number,
    patch:
      Partial<ParticipantRow>,
  ) {
    setRows(
      (
        values,
      ) =>
        values.map(
          (
            row,
            rowIndex,
          ) =>
            rowIndex ===
            index
              ? {
                  ...row,
                  ...patch,
                }
              : row,
        ),
    );
  }


  function addParticipant() {
    if (
      rows.length >=
      128
    ) {
      return;
    }

    setRows(
      (
        values,
      ) => [
        ...values,
        blankRow(
          values.length,
        ),
      ],
    );

    setDraft(
      (
        value,
      ) => ({
        ...value,
        participantCount:
          value.participantCount +
          1,
      }),
    );
  }


  function removeParticipant(
    index:
      number,
  ) {
    if (
      rows.length <=
      2
    ) {
      setError(
        'At least two participants are required.',
      );

      return;
    }

    setRows(
      (
        values,
      ) =>
        values.filter(
          (
            _,
            rowIndex,
          ) =>
            rowIndex !==
            index,
        ),
    );

    setDraft(
      (
        value,
      ) => ({
        ...value,
        participantCount:
          value.participantCount -
          1,
      }),
    );
  }


  function move(
    index:
      number,
    direction:
      -1 |
      1,
  ) {
    const target =
      index +
      direction;

    if (
      target <
        0 ||
      target >=
        rows.length
    ) {
      return;
    }

    const next = [
      ...rows,
    ];

    [
      next[index],
      next[target],
    ] = [
      next[target],
      next[index],
    ];

    setRows(
      next,
    );
  }


  function clearParticipants() {
    if (
      !window.confirm(
        'Clear the current participant selection?',
      )
    ) {
      return;
    }

    setRows(
      Array.from(
        {
          length:
            draft.participantCount,
        },
        (
          _,
          index,
        ) =>
          blankRow(
            index,
          ),
      ),
    );
  }


  function importTournamentEntry(
    entry:
      ExistingEntry,
  ) {
    if (
      selectedIds.has(
        entry.id,
      )
    ) {
      return;
    }

    const emptyIndex =
      rows.findIndex(
        (
          row,
        ) =>
          !row.name.trim(),
      );

    if (
      emptyIndex <
      0
    ) {
      setError(
        'All participant slots are filled. Add another participant slot or replace an existing row.',
      );

      return;
    }

    updateRow(
      emptyIndex,
      {
        registrationId:
          entry.id,
        name:
          entry.entryName ??
          'Unnamed Participant',
        logoUrl:
          entry.entryLogoUrl ??
          '',
        groupId:
          entry.groupId,
        source:
          'TOURNAMENT',
      },
    );
  }


  function importLeagueTeam(
    team:
      LeagueTeamCandidate,
  ) {
    const normalized =
      team.name
        .trim()
        .toLocaleLowerCase();

    if (
      rows.some(
        (
          row,
        ) =>
          row.name
            .trim()
            .toLocaleLowerCase() ===
          normalized,
      )
    ) {
      return;
    }

    const emptyIndex =
      rows.findIndex(
        (
          row,
        ) =>
          !row.name.trim(),
      );

    if (
      emptyIndex <
      0
    ) {
      setError(
        'All participant slots are filled.',
      );

      return;
    }

    updateRow(
      emptyIndex,
      {
        registrationId:
          null,
        name:
          team.name,
        logoUrl:
          team.logoUrl ??
          '',
        source:
          'LEAGUE',
      },
    );
  }


  function importLeagueMember(
    member:
      LeagueMember,
  ) {
    const name =
      member.user
        .inGameName ||
      member.user
        .fullName;

    const normalized =
      name
        .trim()
        .toLocaleLowerCase();

    if (
      rows.some(
        (
          row,
        ) =>
          row.name
            .trim()
            .toLocaleLowerCase() ===
          normalized,
      )
    ) {
      return;
    }

    const emptyIndex =
      rows.findIndex(
        (
          row,
        ) =>
          !row.name.trim(),
      );

    if (
      emptyIndex <
      0
    ) {
      setError(
        'All participant slots are filled.',
      );

      return;
    }

    updateRow(
      emptyIndex,
      {
        registrationId:
          null,
        name,
        shortName:
          member.user
            .inGameName ??
          '',
        source:
          'LEAGUE',
      },
    );
  }


  async function uploadCrest(
    index:
      number,
    file?:
      File,
  ) {
    if (!file) {
      return;
    }

    try {
      const value =
        await imageToDataUrl(
          file,
        );

      updateRow(
        index,
        {
          logoUrl:
            value,
        },
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load crest.',
      );
    }
  }


  async function next() {
    setError(
      '',
    );

    if (
      rows.length !==
      draft.participantCount
    ) {
      setError(
        'Participant slot count does not match the fixture setup.',
      );

      return;
    }

    const names =
      rows.map(
        (
          row,
        ) =>
          row.name.trim(),
      );

    if (
      names.some(
        (
          name,
        ) =>
          !name,
      )
    ) {
      setError(
        'Every participant must have a name.',
      );

      return;
    }

    const normalized =
      names.map(
        (
          name,
        ) =>
          name.toLocaleLowerCase(),
      );

    if (
      new Set(
        normalized,
      ).size !==
      normalized.length
    ) {
      setError(
        'Participant names must be unique.',
      );

      return;
    }

    if (
      draft.scope ===
        'GROUP' &&
      !draft.groupId
    ) {
      setError(
        'The selected Group is missing. Return to Setup.',
      );

      return;
    }

    setBusy(
      true,
    );

    try {
      const saved:
        FixtureParticipantMeta[] =
        [];

      for (
        let index =
            0;
          index <
          rows.length;
        index++
      ) {
        const row =
          rows[index];

        let registrationId =
          row.registrationId;

        let source =
          row.source;

        if (
          !registrationId
        ) {
          const response =
            await authenticatedRequest<any>(
              `/tournaments/${draft.tournamentId}/entries`,
              {
                method:
                  'POST',

                body:
                  JSON.stringify({
                    entryName:
                      row.name.trim(),

                    ...(row.logoUrl
                      ? {
                          entryLogoUrl:
                            row.logoUrl,
                        }
                      : {}),
                  }),
              },
            );

          registrationId =
            response
              .data
              .entry
              .id;

          source =
            row.source ===
            'LEAGUE'
              ? 'LEAGUE'
              : 'MANUAL';
        }

        if (
          registrationId
        ) {
          await authenticatedRequest(
            `/tournaments/${draft.tournamentId}/entries/${registrationId}`,
            {
              method:
                'PATCH',

              body:
                JSON.stringify({
                  entryName:
                    row.name.trim(),

                  ...(row.logoUrl
                    ? {
                        entryLogoUrl:
                          row.logoUrl,
                      }
                    : {}),
                }),
            },
          );
        }

        const targetGroupId =
          draft.scope ===
          'GROUP'
            ? draft.groupId
            : row.groupId;

        if (
          registrationId &&
          targetGroupId &&
          row.groupId !==
          targetGroupId
        ) {
          await authenticatedRequest(
            `/tournaments/${draft.tournamentId}/registrations/${registrationId}/group`,
            {
              method:
                'PATCH',

              body:
                JSON.stringify({
                  groupId:
                    targetGroupId,
                }),
            },
          );
        }

        if (
          !registrationId
        ) {
          throw new Error(
            'Unable to create participant.',
          );
        }

        saved.push({
          registrationId,
          name:
            row.name.trim(),
          shortName:
            row.shortName.trim() ||
            undefined,
          logoUrl:
            row.logoUrl ||
            null,
          source,
        });
      }

      const nextDraft: FixtureGeneratorDraft = {
        ...draft,
        participantCount:
          saved.length,
        selectedRegistrationIds:
          saved.map(
            (
              participant,
            ) =>
              participant.registrationId,
          ),
        participants:
          saved,
      };

      saveFixtureGeneratorDraft(
        nextDraft,
      );

      router.push(
        '/fixtures/generate/rules',
      );
    } catch (
      err
    ) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save participants.',
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  if (
    !user
  ) {
    return (
      <FcLoadingScreen
        label="Loading Participants..."
      />
    );
  }


  const visibleExisting =
    draft.scope ===
      'GROUP' &&
    draft.groupId
      ? entries.filter(
          (
            entry,
          ) =>
            entry.groupId ===
            draft.groupId,
        )
      : entries;


  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName
      }
    >
      <FixtureGeneratorShell
        step="PARTICIPANTS"
        title="Add Participants"
        description={`Add exactly ${draft.participantCount} ${draft.participantType === 'TEAM' ? 'teams' : 'players'}. Manual entry is always available; existing competition data can be imported as a convenience.`}
      >
        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {
              error
            }
          </div>
        ) : null}


        <FcPanel className="p-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                setInputMode(
                  'MANUAL',
                )
              }
              className={`min-h-11 rounded-[10px] border px-4 text-sm font-medium ${
                inputMode ===
                'MANUAL'
                  ? 'border-sky-400/30 bg-sky-400/[0.10] text-[#F8FAFC]'
                  : 'border-[#253140] text-[#A7B0BE]'
              }`}
            >
              Manual Entry
            </button>

            <button
              type="button"
              onClick={() =>
                setInputMode(
                  'IMPORT',
                )
              }
              className={`min-h-11 rounded-[10px] border px-4 text-sm font-medium ${
                inputMode ===
                'IMPORT'
                  ? 'border-sky-400/30 bg-sky-400/[0.10] text-[#F8FAFC]'
                  : 'border-[#253140] text-[#A7B0BE]'
              }`}
            >
              Import Existing
            </button>
          </div>
        </FcPanel>


        {inputMode ===
        'IMPORT' ? (
          <FcPanel className="p-5">
            <h2 className="text-lg font-semibold">
              Existing Tournament Participants
            </h2>

            <p className="mt-1 text-sm text-[#6F7B8A]">
              Add approved entries into empty participant slots.
            </p>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {visibleExisting.map(
                (
                  entry,
                ) => (
                  <button
                    key={
                      entry.id
                    }
                    type="button"
                    disabled={
                      selectedIds.has(
                        entry.id,
                      )
                    }
                    onClick={() =>
                      importTournamentEntry(
                        entry,
                      )
                    }
                    className="flex items-center gap-3 rounded-xl border border-[#253140] bg-[#151C26] p-3 text-left disabled:opacity-40"
                  >
                    <FcCrest
                      name={
                        entry.entryName ??
                        'Entry'
                      }
                      imageUrl={
                        entry.entryLogoUrl
                      }
                      size="sm"
                    />

                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {entry.entryName ??
                        'Unnamed Participant'}
                    </span>

                    <span className="text-[#38BDF8]">
                      +
                    </span>
                  </button>
                ),
              )}
            </div>


            {draft.participantType ===
              'TEAM' &&
            leagueTeams.length >
              0 ? (
              <>
                <h3 className="mt-6 text-base font-semibold">
                  League Teams
                </h3>

                <p className="mt-1 text-sm text-[#6F7B8A]">
                  Existing team names from other Tournaments in this League can be copied into the current fixture setup.
                </p>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {leagueTeams.map(
                    (
                      team,
                    ) => (
                      <button
                        key={
                          team.key
                        }
                        type="button"
                        onClick={() =>
                          importLeagueTeam(
                            team,
                          )
                        }
                        className="flex items-center gap-3 rounded-xl border border-[#253140] bg-[#151C26] p-3 text-left"
                      >
                        <FcCrest
                          name={
                            team.name
                          }
                          imageUrl={
                            team.logoUrl
                          }
                          size="sm"
                        />

                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {
                            team.name
                          }
                        </span>

                        <span className="text-[#38BDF8]">
                          +
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </>
            ) : null}


            {draft.participantType ===
            'PLAYER' ? (
              <>
                <h3 className="mt-6 text-base font-semibold">
                  League Players
                </h3>

                <p className="mt-1 text-sm text-[#6F7B8A]">
                  Imported League players are added as admin-managed Tournament participants when you continue.
                </p>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {leagueMembers.map(
                    (
                      member,
                    ) => (
                      <button
                        key={
                          member.membershipId
                        }
                        type="button"
                        onClick={() =>
                          importLeagueMember(
                            member,
                          )
                        }
                        className="rounded-xl border border-[#253140] bg-[#151C26] p-3 text-left"
                      >
                        <p className="truncate text-sm font-medium">
                          {member.user.inGameName ||
                            member.user.fullName}
                        </p>

                        <p className="mt-1 text-xs text-[#6F7B8A]">
                          {member.user.playerCode ||
                            member.user.fullName}
                        </p>
                      </button>
                    ),
                  )}
                </div>
              </>
            ) : null}
          </FcPanel>
        ) : null}


        <div className="space-y-3">
          {rows.map(
            (
              row,
              index,
            ) => (
              <FcPanel
                key={
                  row.key
                }
                className="p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {draft.participantType ===
                      'TEAM'
                        ? 'Team'
                        : 'Player'}{' '}
                      {index +
                        1}
                    </p>

                    <div className="mt-1">
                      <FcStatusBadge
                        label={
                          row.source
                        }
                        tone={
                          row.source ===
                          'MANUAL'
                            ? 'slate'
                            : 'cyan'
                        }
                      />
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        move(
                          index,
                          -1,
                        )
                      }
                      className="grid h-9 w-9 place-items-center rounded-[9px] border border-[#253140] text-[#A7B0BE]"
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        move(
                          index,
                          1,
                        )
                      }
                      className="grid h-9 w-9 place-items-center rounded-[9px] border border-[#253140] text-[#A7B0BE]"
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        removeParticipant(
                          index,
                        )
                      }
                      className="grid h-9 w-9 place-items-center rounded-[9px] border border-red-400/20 text-red-300"
                    >
                      ×
                    </button>
                  </div>
                </div>


                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-[#A7B0BE]">
                      {draft.participantType ===
                      'TEAM'
                        ? 'Team Name'
                        : 'Player Name'}
                    </span>

                    <input
                      value={
                        row.name
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          updateRow(
                            index,
                            {
                              name:
                                event
                                  .target
                                  .value,
                            },
                          )
                      }
                      placeholder={`Enter ${draft.participantType === 'TEAM' ? 'team' : 'player'} ${index + 1}`}
                      className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                    />
                  </label>


                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-[#A7B0BE]">
                      Short Name
                    </span>

                    <input
                      value={
                        row.shortName
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          updateRow(
                            index,
                            {
                              shortName:
                                event
                                  .target
                                  .value,
                            },
                          )
                      }
                      maxLength={
                        12
                      }
                      placeholder="Optional"
                      className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                    />
                  </label>


                  {draft.participantType ===
                  'TEAM' ? (
                    <>
                      <label className="grid gap-2">
                        <span className="text-xs font-medium text-[#A7B0BE]">
                          Crest URL
                        </span>

                        <input
                          value={
                            row.logoUrl.startsWith(
                              'data:',
                            )
                              ? ''
                              : row.logoUrl
                          }
                          onChange={
                            (
                              event,
                            ) =>
                              updateRow(
                                index,
                                {
                                  logoUrl:
                                    event
                                      .target
                                      .value,
                                },
                              )
                          }
                          placeholder="https://..."
                          className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-xs font-medium text-[#A7B0BE]">
                          Upload Crest
                        </span>

                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={
                            (
                              event,
                            ) =>
                              void uploadCrest(
                                index,
                                event
                                  .target
                                  .files?.[0],
                              )
                          }
                          className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-3 py-2 text-xs text-[#A7B0BE]"
                        />
                      </label>
                    </>
                  ) : null}


                  {groups.length >
                    0 &&
                  draft.scope ===
                    'TOURNAMENT' ? (
                    <label className="grid gap-2">
                      <span className="text-xs font-medium text-[#A7B0BE]">
                        Group
                      </span>

                      <select
                        value={
                          row.groupId ??
                          ''
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            updateRow(
                              index,
                              {
                                groupId:
                                  event
                                    .target
                                    .value ||
                                  null,
                              },
                            )
                        }
                        className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4"
                      >
                        <option value="">
                          Unassigned
                        </option>

                        {groups.map(
                          (
                            group,
                          ) => (
                            <option
                              key={
                                group.id
                              }
                              value={
                                group.id
                              }
                            >
                              {
                                group.name
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  ) : null}
                </div>


                {row.registrationId ? (
                  <button
                    type="button"
                    onClick={() =>
                      updateRow(
                        index,
                        {
                          registrationId:
                            null,
                          source:
                            'MANUAL',
                        },
                      )
                    }
                    className="mt-4 text-xs font-medium text-[#38BDF8]"
                  >
                    Replace imported participant
                  </button>
                ) : null}
              </FcPanel>
            ),
          )}
        </div>


        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={
              addParticipant
            }
            className="min-h-11 rounded-[10px] border border-[#253140] bg-[#151C26] px-4 text-sm font-medium text-[#F8FAFC]"
          >
            + Add Participant
          </button>

          <button
            type="button"
            onClick={
              clearParticipants
            }
            className="min-h-11 rounded-[10px] border border-[#253140] px-4 text-sm font-medium text-[#A7B0BE]"
          >
            Clear
          </button>
        </div>


        <div className="flex items-center justify-between border-t border-[#253140] pt-5">
          <button
            type="button"
            onClick={() =>
              router.push(
                '/fixtures/generate',
              )
            }
            className="min-h-11 rounded-[10px] px-4 text-sm font-medium text-[#A7B0BE] hover:bg-[#151C26]"
          >
            ← Back
          </button>

          <button
            type="button"
            disabled={
              busy
            }
            onClick={() =>
              void next()
            }
            className="min-h-11 rounded-[10px] bg-[#38BDF8] px-5 text-sm font-semibold text-[#071018] hover:bg-[#0EA5E9] disabled:opacity-40"
          >
            {busy
              ? 'Saving Participants...'
              : 'Next — Fixture Rules →'}
          </button>
        </div>
      </FixtureGeneratorShell>
    </AppShell>
  );
}

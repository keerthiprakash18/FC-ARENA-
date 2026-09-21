'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  useParams,
  useRouter,
} from 'next/navigation';

import {
  AppShell,
} from '@/components/app/app-shell';

import {
  FcErrorState,
  FcLoadingScreen,
  FcPageHeader,
  FcPanel,
  FcStatusBadge,
} from '@/components/fc/fc-ui';

import type {
  FixtureEntryForUi,
  FixtureForUi,
} from '@/components/tournaments/fixture-card';

import {
  authenticatedRequest,
  type CurrentUser,
  getCurrentUser,
} from '@/lib/auth-client';

type PosterMode =
  | 'FIXTURE'
  | 'RESULT'
  | 'STANDINGS'
  | 'CHAMPION';

type PosterTheme =
  | 'GOLD'
  | 'BLUE';

interface Tournament {
  id: string;
  name: string;
  code: string;
  status: string;
  league: {
    id: string;
    name: string;
    code: string;
  };
}

interface Standing {
  position: number;
  registrationId: string;
  entryName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string;
}

interface ResultSubmission {
  id: string;
  homeScore: number;
  awayScore: number;
  status: string;
}

interface ResultsPayload {
  confirmedResultSubmissionId:
    string | null;
  submissions:
    ResultSubmission[];
}

const palettes = {
  GOLD: {
    top: '#071426',
    bottom: '#020813',
    panel: '#0c1b2e',
    panelAlt: '#11243a',
    accent: '#d9ad55',
    accentSoft: '#f4d58d',
    text: '#fff8e8',
    muted: '#9ba9bb',
    line: '#243751',
  },
  BLUE: {
    top: '#08245a',
    bottom: '#041021',
    panel: '#0b2d68',
    panelAlt: '#113b83',
    accent: '#55a7ff',
    accentSoft: '#9bd0ff',
    text: '#f7fbff',
    muted: '#aac3dd',
    line: '#28558a',
  },
} as const;

function xml(
  value: string,
) {
  return value
    .replaceAll(
      '&',
      '&amp;',
    )
    .replaceAll(
      '<',
      '&lt;',
    )
    .replaceAll(
      '>',
      '&gt;',
    )
    .replaceAll(
      '"',
      '&quot;',
    )
    .replaceAll(
      "'",
      '&apos;',
    );
}

function shortText(
  value: string,
  length = 28,
) {
  return value.length >
    length
    ? value.slice(
        0,
        length - 1,
      ) + '…'
    : value;
}

function entryName(
  entry:
    | FixtureEntryForUi
    | null,
) {
  if (!entry) {
    return 'TBD';
  }

  if (
    entry.entryName
  ) {
    return entry.entryName;
  }

  return (
    entry.members
      .map(
        (member) =>
          member.inGameName ||
          member.fullName,
      )
      .filter(Boolean)
      .join(' + ') ||
    'TBD'
  );
}

function textNode(
  x: number,
  y: number,
  value: string,
  size: number,
  color: string,
  weight = 700,
  anchor:
    | 'start'
    | 'middle'
    | 'end' =
    'start',
) {
  return (
    '<text x="' +
    x +
    '" y="' +
    y +
    '" fill="' +
    color +
    '" font-size="' +
    size +
    '" font-weight="' +
    weight +
    '" text-anchor="' +
    anchor +
    '" font-family="Arial, sans-serif">' +
    xml(
      value,
    ) +
    '</text>'
  );
}

function buildPosterSvg(
  tournament:
    Tournament,
  mode: PosterMode,
  theme:
    PosterTheme,
  fixture:
    | FixtureForUi
    | null,
  result:
    | ResultSubmission
    | null,
  standings:
    Standing[],
) {
  const palette =
    palettes[theme];

  const sorted =
    standings
      .slice()
      .sort(
        (
          a,
          b,
        ) =>
          a.position -
          b.position,
      );

  const labels:
    Record<
      PosterMode,
      string
    > = {
      FIXTURE:
        'MATCHDAY FIXTURE',
      RESULT:
        'FULL TIME RESULT',
      STANDINGS:
        'STANDINGS',
      CHAMPION:
        'TOURNAMENT CHAMPION',
    };

  const header = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">',
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="' +
      palette.top +
      '"/><stop offset="100%" stop-color="' +
      palette.bottom +
      '"/></linearGradient></defs>',
    '<rect width="1080" height="1350" fill="url(#bg)"/>',
    '<rect width="14" height="1350" fill="' +
      palette.accent +
      '"/>',
    '<circle cx="980" cy="70" r="260" fill="' +
      palette.accent +
      '" opacity="0.10"/>',
    textNode(
      74,
      92,
      'FC ARENA',
      30,
      palette.accentSoft,
      900,
    ),
    textNode(
      74,
      132,
      labels[mode],
      20,
      palette.muted,
      700,
    ),
    textNode(
      74,
      216,
      shortText(
        tournament.name,
        29,
      ),
      54,
      palette.text,
      900,
    ),
    textNode(
      74,
      260,
      shortText(
        tournament.league.name,
        31,
      ) +
        ' • ' +
        tournament.code,
      22,
      palette.muted,
      600,
    ),
    '<line x1="74" y1="302" x2="1006" y2="302" stroke="' +
      palette.line +
      '" stroke-width="2"/>',
  ].join('');

  let body = '';

  if (
    mode ===
      'FIXTURE' &&
    fixture
  ) {
    const scheduled =
      fixture.scheduledAt
        ? new Intl.DateTimeFormat(
            undefined,
            {
              dateStyle:
                'medium',
              timeStyle:
                'short',
            },
          ).format(
            new Date(
              fixture.scheduledAt,
            ),
          )
        : 'Schedule to be announced';

    body = [
      '<rect x="74" y="360" width="932" height="720" rx="42" fill="' +
        palette.panel +
        '"/>',
      textNode(
        540,
        430,
        shortText(
          fixture.roundName,
          34,
        ),
        24,
        palette.accentSoft,
        800,
        'middle',
      ),
      textNode(
        540,
        475,
        (fixture.group
          ?.name ||
          'OFFICIAL FIXTURE') +
          (fixture.matchday
            ? ' • MATCHDAY ' +
              fixture.matchday
            : ''),
        19,
        palette.muted,
        700,
        'middle',
      ),
      '<rect x="124" y="555" width="330" height="260" rx="32" fill="' +
        palette.panelAlt +
        '"/>',
      '<rect x="626" y="555" width="330" height="260" rx="32" fill="' +
        palette.panelAlt +
        '"/>',
      textNode(
        289,
        690,
        shortText(
          entryName(
            fixture.home,
          ),
          18,
        ),
        36,
        palette.text,
        900,
        'middle',
      ),
      textNode(
        540,
        690,
        'VS',
        42,
        palette.accent,
        900,
        'middle',
      ),
      textNode(
        791,
        690,
        shortText(
          entryName(
            fixture.away,
          ),
          18,
        ),
        36,
        palette.text,
        900,
        'middle',
      ),
      textNode(
        540,
        910,
        scheduled,
        28,
        palette.text,
        800,
        'middle',
      ),
      textNode(
        540,
        955,
        shortText(
          fixture.venue ||
            fixture.fixtureCode,
          45,
        ),
        20,
        palette.muted,
        600,
        'middle',
      ),
    ].join('');
  }

  if (
    mode ===
      'RESULT' &&
    fixture &&
    result
  ) {
    body = [
      '<rect x="74" y="360" width="932" height="720" rx="42" fill="' +
        palette.panel +
        '"/>',
      textNode(
        540,
        430,
        shortText(
          fixture.roundName,
          34,
        ),
        24,
        palette.accentSoft,
        800,
        'middle',
      ),
      textNode(
        540,
        565,
        shortText(
          entryName(
            fixture.home,
          ),
          28,
        ),
        40,
        palette.text,
        900,
        'middle',
      ),
      textNode(
        540,
        760,
        String(
          result.homeScore,
        ) +
          '  -  ' +
          String(
            result.awayScore,
          ),
        132,
        palette.accent,
        900,
        'middle',
      ),
      textNode(
        540,
        870,
        shortText(
          entryName(
            fixture.away,
          ),
          28,
        ),
        40,
        palette.text,
        900,
        'middle',
      ),
      textNode(
        540,
        965,
        'CONFIRMED RESULT',
        20,
        palette.muted,
        700,
        'middle',
      ),
    ].join('');
  }

  if (
    mode ===
    'STANDINGS'
  ) {
    const rows =
      sorted
        .slice(
          0,
          10,
        )
        .map(
          (
            row,
            index,
          ) => {
            const y =
              474 +
              index * 66;

            const stripe =
              index % 2 ===
              0
                ? '<rect x="98" y="' +
                  (y - 39) +
                  '" width="884" height="54" rx="14" fill="' +
                  palette.panelAlt +
                  '"/>'
                : '';

            return [
              stripe,
              textNode(
                116,
                y,
                String(
                  row.position,
                ),
                22,
                index < 3
                  ? palette.accentSoft
                  : palette.text,
                800,
              ),
              textNode(
                178,
                y,
                shortText(
                  row.entryName,
                  29,
                ),
                22,
                index < 3
                  ? palette.accentSoft
                  : palette.text,
                800,
              ),
              textNode(
                716,
                y,
                String(
                  row.played,
                ),
                22,
                palette.text,
                800,
                'middle',
              ),
              textNode(
                812,
                y,
                (row.goalDifference >
                0
                  ? '+'
                  : '') +
                  row.goalDifference,
                22,
                palette.text,
                800,
                'middle',
              ),
              textNode(
                925,
                y,
                String(
                  row.points,
                ),
                24,
                palette.accentSoft,
                900,
                'middle',
              ),
            ].join('');
          },
        )
        .join('');

    body = [
      '<rect x="74" y="350" width="932" height="820" rx="36" fill="' +
        palette.panel +
        '"/>',
      textNode(
        112,
        410,
        '#',
        18,
        palette.muted,
      ),
      textNode(
        178,
        410,
        'ENTRY',
        18,
        palette.muted,
      ),
      textNode(
        716,
        410,
        'P',
        18,
        palette.muted,
        700,
        'middle',
      ),
      textNode(
        812,
        410,
        'GD',
        18,
        palette.muted,
        700,
        'middle',
      ),
      textNode(
        925,
        410,
        'PTS',
        18,
        palette.muted,
        700,
        'middle',
      ),
      rows ||
        textNode(
          540,
          720,
          'No confirmed standings yet',
          28,
          palette.muted,
          700,
          'middle',
        ),
    ].join('');
  }

  if (
    mode ===
    'CHAMPION'
  ) {
    const champion =
      sorted[0];

    if (
      champion
    ) {
      body = [
        '<rect x="74" y="360" width="932" height="720" rx="42" fill="' +
          palette.panel +
          '"/>',
        textNode(
          540,
          535,
          '★',
          116,
          palette.accent,
          900,
          'middle',
        ),
        textNode(
          540,
          610,
          'CHAMPIONS',
          22,
          palette.muted,
          800,
          'middle',
        ),
        textNode(
          540,
          715,
          shortText(
            champion.entryName,
            28,
          ),
          58,
          palette.text,
          900,
          'middle',
        ),
        '<rect x="210" y="815" width="660" height="132" rx="28" fill="' +
          palette.panelAlt +
          '"/>',
        textNode(
          540,
          890,
          String(
            champion.points,
          ) +
            ' PTS • ' +
            String(
              champion.wins,
            ) +
            ' WINS • GD ' +
            (champion.goalDifference >=
            0
              ? '+'
              : '') +
            champion.goalDifference,
          28,
          palette.accentSoft,
          900,
          'middle',
        ),
      ].join('');
    }
  }

  const footer = [
    '<line x1="74" y1="1250" x2="1006" y2="1250" stroke="' +
      palette.line +
      '" stroke-width="2"/>',
    textNode(
      74,
      1294,
      'PLAY • COMPETE • BELONG',
      18,
      palette.muted,
      600,
    ),
    textNode(
      1006,
      1294,
      'fcarena.in',
      18,
      palette.muted,
      600,
      'end',
    ),
    '</svg>',
  ].join('');

  return (
    header +
    body +
    footer
  );
}

export default function TournamentPosterPage() {
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
    useState<FixtureForUi[]>(
      [],
    );

  const [
    standings,
    setStandings,
  ] =
    useState<Standing[]>(
      [],
    );

  const [
    mode,
    setMode,
  ] =
    useState<PosterMode>(
      'FIXTURE',
    );

  const [
    theme,
    setTheme,
  ] =
    useState<PosterTheme>(
      'GOLD',
    );

  const [
    selectedFixtureId,
    setSelectedFixtureId,
  ] =
    useState('');

  const [
    confirmedResult,
    setConfirmedResult,
  ] =
    useState<ResultSubmission | null>(
      null,
    );

  const [
    previewSvg,
    setPreviewSvg,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    generating,
    setGenerating,
  ] =
    useState(false);

  const [
    exporting,
    setExporting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [
          current,
          tournamentResponse,
          fixtureResponse,
          standingsResponse,
        ] =
          await Promise.all([
            getCurrentUser(),

            authenticatedRequest<{
              success: true;
              data: {
                tournament:
                  Tournament;
              };
              error: null;
            }>(
              '/tournaments/' +
                tournamentId,
            ),

            authenticatedRequest<{
              success: true;
              data: {
                fixtures:
                  FixtureForUi[];
              };
              error: null;
            }>(
              '/tournaments/' +
                tournamentId +
                '/fixtures',
            ).catch(
              () => ({
                success:
                  true as const,
                data: {
                  fixtures:
                    [] as FixtureForUi[],
                },
                error:
                  null,
              }),
            ),

            authenticatedRequest<{
              success: true;
              data: {
                standings:
                  Standing[];
              };
              error: null;
            }>(
              '/tournaments/' +
                tournamentId +
                '/standings',
            ).catch(
              () => ({
                success:
                  true as const,
                data: {
                  standings:
                    [] as Standing[],
                },
                error:
                  null,
              }),
            ),
          ]);

        setUser(
          current,
        );

        setTournament(
          tournamentResponse
            .data
            .tournament,
        );

        setFixtures(
          fixtureResponse
            .data
            .fixtures,
        );

        setStandings(
          standingsResponse
            .data
            .standings,
        );

        setSelectedFixtureId(
          fixtureResponse
            .data
            .fixtures[0]
            ?.id || '',
        );
      } catch {
        router.replace(
          '/tournaments',
        );
      } finally {
        setLoading(
          false,
        );
      }
    })();
  }, [
    router,
    tournamentId,
  ]);

  const selectedFixture =
    fixtures.find(
      (fixture) =>
        fixture.id ===
        selectedFixtureId,
    ) || null;

  function resetPreview() {
    setPreviewSvg('');
    setConfirmedResult(
      null,
    );
    setError('');
  }

  async function generatePreview() {
    if (
      !tournament
    ) {
      return;
    }

    setGenerating(
      true,
    );

    setError('');

    try {
      let result =
        confirmedResult;

      if (
        mode ===
        'CHAMPION'
      ) {
        if (
          tournament.status !==
          'COMPLETED'
        ) {
          throw new Error(
            'Champion poster becomes available after the Tournament is completed.',
          );
        }

        if (
          standings.length ===
          0
        ) {
          throw new Error(
            'No confirmed champion standing is available yet.',
          );
        }
      }

      if (
        (mode ===
          'FIXTURE' ||
          mode ===
            'RESULT') &&
        !selectedFixture
      ) {
        throw new Error(
          'Select a fixture first.',
        );
      }

      if (
        mode ===
        'RESULT'
      ) {
        if (
          !selectedFixture
            ?.match?.id
        ) {
          throw new Error(
            'This fixture does not have a Match Center yet.',
          );
        }

        const response =
          await authenticatedRequest<{
            success: true;
            data:
              ResultsPayload;
            error: null;
          }>(
            '/matches/' +
              selectedFixture
                .match.id +
              '/results',
          );

        result =
          response.data
            .submissions
            .find(
              (
                submission,
              ) =>
                submission.id ===
                  response.data
                    .confirmedResultSubmissionId &&
                submission.status ===
                  'CONFIRMED',
            ) ||
          null;

        if (
          !result
        ) {
          throw new Error(
            'This match does not have a confirmed result yet.',
          );
        }

        setConfirmedResult(
          result,
        );
      }

      setPreviewSvg(
        buildPosterSvg(
          tournament,
          mode,
          theme,
          selectedFixture,
          result,
          standings,
        ),
      );
    } catch (err) {
      setPreviewSvg('');
      setConfirmedResult(
        null,
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate poster preview.',
      );
    } finally {
      setGenerating(
        false,
      );
    }
  }

  async function exportPng() {
    if (
      !previewSvg ||
      !tournament
    ) {
      return;
    }

    setExporting(
      true,
    );

    setError('');

    try {
      const source =
        new Blob(
          [
            previewSvg,
          ],
          {
            type:
              'image/svg+xml;charset=utf-8',
          },
        );

      const sourceUrl =
        URL.createObjectURL(
          source,
        );

      await new Promise<void>(
        (
          resolve,
          reject,
        ) => {
          const image =
            new Image();

          image.onload =
            () => {
              const canvas =
                document.createElement(
                  'canvas',
                );

              canvas.width =
                1080;

              canvas.height =
                1350;

              const context =
                canvas.getContext(
                  '2d',
                );

              if (
                !context
              ) {
                URL.revokeObjectURL(
                  sourceUrl,
                );

                reject(
                  new Error(
                    'Unable to create export canvas.',
                  ),
                );

                return;
              }

              context.drawImage(
                image,
                0,
                0,
                1080,
                1350,
              );

              canvas.toBlob(
                (
                  output,
                ) => {
                  URL.revokeObjectURL(
                    sourceUrl,
                  );

                  if (
                    !output
                  ) {
                    reject(
                      new Error(
                        'Unable to create PNG file.',
                      ),
                    );

                    return;
                  }

                  const url =
                    URL.createObjectURL(
                      output,
                    );

                  const anchor =
                    document.createElement(
                      'a',
                    );

                  anchor.href =
                    url;

                  anchor.download =
                    'fc-arena-' +
                    tournament.code.toLowerCase() +
                    '-' +
                    mode.toLowerCase() +
                    '.png';

                  document.body.appendChild(
                    anchor,
                  );

                  anchor.click();
                  anchor.remove();

                  URL.revokeObjectURL(
                    url,
                  );

                  resolve();
                },
                'image/png',
                1,
              );
            };

          image.onerror =
            () => {
              URL.revokeObjectURL(
                sourceUrl,
              );

              reject(
                new Error(
                  'Unable to render poster for export.',
                ),
              );
            };

          image.src =
            sourceUrl;
        },
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to export PNG.',
      );
    } finally {
      setExporting(
        false,
      );
    }
  }

  if (
    loading ||
    !user ||
    !tournament
  ) {
    return (
      <FcLoadingScreen
        label="Loading Poster Studio..."
      />
    );
  }

  const previewUrl =
    previewSvg
      ? 'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(
          previewSvg,
        )
      : '';

  return (
    <AppShell
      playerName={
        user.player
          ?.identity
          ?.inGameName ||
        user.fullName
      }
    >
      <div className="space-y-6">
        <FcPageHeader
          eyebrow="Shareable graphics"
          title="Auto Poster Studio"
          subtitle="Generate FC ARENA branded fixture, confirmed result, standings and champion graphics from live Tournament data."
          action={
            <FcStatusBadge
              label="Read only"
              tone="emerald"
            />
          }
        />

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <FcPanel className="h-fit p-5">
            <div className="space-y-5">
              <div>
                <p className="theme-muted text-xs font-bold uppercase tracking-[0.14em]">
                  Tournament
                </p>

                <p className="theme-text mt-2 text-lg font-black">
                  {
                    tournament.name
                  }
                </p>

                <p className="theme-secondary-text mt-1 text-xs">
                  {
                    tournament.league
                      .name
                  }
                </p>
              </div>

              <label className="grid gap-2">
                <span className="theme-muted text-xs font-bold uppercase tracking-[0.14em]">
                  Poster Type
                </span>

                <select
                  value={
                    mode
                  }
                  onChange={(
                    event,
                  ) => {
                    setMode(
                      event.target
                        .value as PosterMode,
                    );

                    resetPreview();
                  }}
                  className="theme-input min-h-11 rounded-xl border px-3 text-sm"
                >
                  <option value="FIXTURE">
                    Fixture / Matchday
                  </option>

                  <option value="RESULT">
                    Confirmed Result
                  </option>

                  <option value="STANDINGS">
                    Standings
                  </option>

                  <option value="CHAMPION">
                    Champion
                  </option>
                </select>
              </label>

              {mode ===
                'FIXTURE' ||
              mode ===
                'RESULT' ? (
                <label className="grid gap-2">
                  <span className="theme-muted text-xs font-bold uppercase tracking-[0.14em]">
                    Match
                  </span>

                  <select
                    value={
                      selectedFixtureId
                    }
                    onChange={(
                      event,
                    ) => {
                      setSelectedFixtureId(
                        event.target
                          .value,
                      );

                      resetPreview();
                    }}
                    className="theme-input min-h-11 rounded-xl border px-3 text-sm"
                  >
                    {fixtures.length ===
                    0 ? (
                      <option value="">
                        No fixtures available
                      </option>
                    ) : (
                      fixtures.map(
                        (
                          fixture,
                        ) => (
                          <option
                            key={
                              fixture.id
                            }
                            value={
                              fixture.id
                            }
                          >
                            {
                              fixture.roundName
                            } — {
                              entryName(
                                fixture.home,
                              )
                            } vs {
                              entryName(
                                fixture.away,
                              )
                            }
                          </option>
                        ),
                      )
                    )}
                  </select>
                </label>
              ) : null}

              <div>
                <p className="theme-muted text-xs font-bold uppercase tracking-[0.14em]">
                  Poster Theme
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTheme(
                        'GOLD',
                      );

                      resetPreview();
                    }}
                    className={
                      theme ===
                      'GOLD'
                        ? 'min-h-11 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 text-sm font-bold text-amber-300'
                        : 'theme-secondary-button min-h-11 rounded-xl border px-3 text-sm font-bold'
                    }
                  >
                    Luxury Gold
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTheme(
                        'BLUE',
                      );

                      resetPreview();
                    }}
                    className={
                      theme ===
                      'BLUE'
                        ? 'min-h-11 rounded-xl border border-sky-400/40 bg-sky-400/10 px-3 text-sm font-bold text-sky-300'
                        : 'theme-secondary-button min-h-11 rounded-xl border px-3 text-sm font-bold'
                    }
                  >
                    Classic Blue
                  </button>
                </div>
              </div>

              {error ? (
                <FcErrorState
                  message={
                    error
                  }
                />
              ) : null}

              <button
                type="button"
                disabled={
                  generating
                }
                onClick={() =>
                  void generatePreview()
                }
                className="theme-primary-button min-h-12 w-full rounded-xl px-4 text-sm font-black disabled:opacity-50"
              >
                {generating
                  ? 'Generating...'
                  : 'Generate Preview'}
              </button>

              <button
                type="button"
                disabled={
                  !previewSvg ||
                  exporting
                }
                onClick={() =>
                  void exportPng()
                }
                className="theme-secondary-button min-h-12 w-full rounded-xl border px-4 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {exporting
                  ? 'Exporting...'
                  : 'Export PNG'}
              </button>

              <p className="theme-muted text-xs leading-5">
                1080 × 1350 portrait format. Poster generation happens in your browser and never modifies Tournament, Fixture, Result or Standings data.
              </p>
            </div>
          </FcPanel>

          <FcPanel className="overflow-hidden p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="theme-text font-black">
                  Poster Preview
                </p>

                <p className="theme-muted mt-1 text-xs">
                  Instagram / WhatsApp portrait
                </p>
              </div>

              <FcStatusBadge
                label={
                  previewSvg
                    ? 'Ready'
                    : 'Preview pending'
                }
                tone={
                  previewSvg
                    ? 'emerald'
                    : 'slate'
                }
              />
            </div>

            <div className="mx-auto max-w-[620px] overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-2xl">
              {previewUrl ? (
                <img
                  src={
                    previewUrl
                  }
                  alt="FC ARENA generated poster preview"
                  className="block h-auto w-full"
                />
              ) : (
                <div className="grid aspect-[4/5] place-items-center p-8 text-center">
                  <div>
                    <p className="theme-text font-black">
                      Preview not generated
                    </p>

                    <p className="theme-muted mt-2 text-sm">
                      Choose a poster type and generate the preview.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </FcPanel>
        </div>
      </div>
    </AppShell>
  );
}

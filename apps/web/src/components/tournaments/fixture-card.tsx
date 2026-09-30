'use client';

import Link from 'next/link';
import { FcStatusBadge } from '@/components/fc/fc-ui';
import {
  useEffect,
  useState,
} from 'react';
import type {
  FormEvent,
} from 'react';
import {
  authenticatedRequest,
} from '@/lib/auth-client';

export interface FixtureEntryForUi {
  id: string;
  entryName: string | null;

  members: Array<{
    id: string;
    fullName: string;
    playerCode: string | null;
    inGameName: string | null;
  }>;
}

export interface FixtureForUi {
  id: string;
  fixtureCode: string;
  sequence: number;
  matchday: number | null;
  roundNumber: number;
  roundName: string;
  bracketPosition: number;
  status: string;
  scheduledAt: string | null;
  venue: string | null;

  group: {
    id: string;
    name: string;
    position: number;
  } | null;

  match: {
    id: string;
    matchCode: string | null;
    status: string;
  } | null;

  home:
    | FixtureEntryForUi
    | null;

  away:
    | FixtureEntryForUi
    | null;

  homeSource: {
    id: string;
    fixtureCode: string;
  } | null;

  awaySource: {
    id: string;
    fixtureCode: string;
  } | null;
}

interface FixtureCardProps {
  fixture: FixtureForUi;
  isAdmin: boolean;
  onChanged: () => Promise<void>;
}

function entryName(
  entry:
    | FixtureEntryForUi
    | null,

  source:
    | {
        fixtureCode: string;
      }
    | null,
) {
  if (entry) {
    if (entry.entryName) {
      return entry.entryName;
    }

    const names =
      entry.members
        .map(
          (member) =>
            member.inGameName ||
            member.fullName,
        )
        .filter(Boolean);

    if (names.length > 0) {
      return names.join(' + ');
    }
  }

  if (source) {
    return `Winner of ${source.fixtureCode}`;
  }

  return 'TBD';
}

function toLocalInput(
  iso: string | null,
) {
  if (!iso) {
    return '';
  }

  const date =
    new Date(iso);

  const offset =
    date.getTimezoneOffset();

  const local =
    new Date(
      date.getTime() -
        offset * 60_000,
    );

  return local
    .toISOString()
    .slice(0, 16);
}

export function FixtureCard({
  fixture,
  isAdmin,
  onChanged,
}: FixtureCardProps) {
  const [
    scheduledAt,
    setScheduledAt,
  ] = useState(
    toLocalInput(
      fixture.scheduledAt,
    ),
  );

  const [venue, setVenue] =
    useState(
      fixture.venue ?? '',
    );

  const [
    matchday,
    setMatchday,
  ] = useState(
    fixture.matchday
      ? String(
          fixture.matchday,
        )
      : '',
  );

  const [
    roundNumber,
    setRoundNumber,
  ] = useState(
    String(
      fixture.roundNumber,
    ),
  );

  const [
    roundName,
    setRoundName,
  ] = useState(
    fixture.roundName,
  );

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    setScheduledAt(
      toLocalInput(
        fixture.scheduledAt,
      ),
    );

    setVenue(
      fixture.venue ?? '',
    );

    setMatchday(
      fixture.matchday
        ? String(
            fixture.matchday,
          )
        : '',
    );

    setRoundNumber(
      String(
        fixture.roundNumber,
      ),
    );

    setRoundName(
      fixture.roundName,
    );
  }, [fixture]);

  async function saveSchedule(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!scheduledAt) {
      setError(
        'Select a date and time.',
      );
      return;
    }

    setBusy(true);
    setError('');

    try {
      await authenticatedRequest(
        `/fixtures/${fixture.id}/schedule`,
        {
          method: 'POST',

          body:
            JSON.stringify({
              scheduledAt:
                new Date(
                  scheduledAt,
                ).toISOString(),

              venue:
                venue || undefined,

              matchday:
                matchday
                  ? Number(
                      matchday,
                    )
                  : undefined,

              roundNumber:
                roundNumber
                  ? Number(
                      roundNumber,
                    )
                  : undefined,

              roundName:
                roundName ||
                undefined,
            }),
        },
      );

      await onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to schedule fixture.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function action(
    type:
      | 'postpone'
      | 'cancel',
  ) {
    const confirmed =
      window.confirm(
        type === 'cancel'
          ? 'Cancel this fixture?'
          : 'Postpone this fixture?',
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await authenticatedRequest(
        `/fixtures/${fixture.id}/${type}`,
        {
          method: 'POST',
        },
      );

      await onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${type} fixture.`,
      );
    } finally {
      setBusy(false);
    }
  }

  const home =
    entryName(
      fixture.home,
      fixture.homeSource,
    );

  const away =
    entryName(
      fixture.away,
      fixture.awaySource,
    );

  return (
    <article className="theme-panel fc-fixture-card rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] text-slate-600">
            {
              fixture.fixtureCode
            }
          </p>

          {fixture.match?.matchCode ? (
            <p className="mt-1 font-mono text-xs font-bold text-sky-400">
              {
                fixture.match
                  .matchCode
              }
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {fixture.group ? (
            <span className="rounded-full bg-sky-400/10 px-3 py-1 text-[10px] font-black text-sky-300">
              {fixture.group.name}
            </span>
          ) : null}

          <FcStatusBadge label={fixture.status} tone={fixture.status === 'COMPLETED' ? 'emerald' : fixture.status === 'CANCELLED' ? 'red' : 'cyan'} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <p className="break-words text-center text-base font-semibold">
          {home}
        </p>

        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-slate-500">
          VS
        </span>

        <p className="break-words text-center text-base font-semibold">
          {away}
        </p>
      </div>

      <div className="mt-5 rounded-xl bg-white/[0.03] p-4 text-center">
        <p className="text-sm font-bold">
          {fixture.scheduledAt
            ? new Date(
                fixture.scheduledAt,
              ).toLocaleString()
            : 'Not scheduled'}
        </p>

        <p className="mt-1 text-xs text-slate-600">
          {fixture.venue ||
            'Venue not assigned'}
        </p>
      </div>

      {fixture.match?.id ? (
        <Link
          href={`/matches/${fixture.match.id}`}
          className="theme-secondary-button mt-4 flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold"
        >
          Open Match Center
        </Link>
      ) : null}

      {isAdmin &&
      fixture.status !==
        'COMPLETED' &&
      fixture.status !==
        'CANCELLED' ? (
        <form
          onSubmit={
            saveSchedule
          }
          className="mt-5 grid gap-3 border-t border-white/10 pt-5"
        >
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Admin Scheduling
          </p>

          <label className="fc-field-label">Date and time
<input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) =>
              setScheduledAt(
                event.target.value,
              )
            }
            required
            className="rounded-xl border border-white/10 bg-[#080e15] px-3 py-2 text-sm"
          />
</label>

          <label className="fc-field-label">Venue / Lobby / Server
<input
            value={venue}
            onChange={(event) =>
              setVenue(
                event.target.value,
              )
            }
            placeholder="Venue / Lobby / Server"
            className="rounded-xl border border-white/10 bg-[#080e15] px-3 py-2 text-sm"
          />
</label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="fc-field-label">Matchday
<input
              value={matchday}
              onChange={(event) =>
                setMatchday(
                  event.target.value,
                )
              }
              type="number"
              min="1"
              placeholder="Matchday"
              className="min-w-0 rounded-xl border border-white/10 bg-[#080e15] px-3 py-2 text-sm"
            />
</label>

            <label className="fc-field-label">Round number
<input
              value={roundNumber}
              onChange={(event) =>
                setRoundNumber(
                  event.target.value,
                )
              }
              type="number"
              min="1"
              placeholder="Round"
              className="min-w-0 rounded-xl border border-white/10 bg-[#080e15] px-3 py-2 text-sm"
            />
</label>

            <label className="fc-field-label">Round name
<input
              value={roundName}
              onChange={(event) =>
                setRoundName(
                  event.target.value,
                )
              }
              placeholder="Round Name"
              className="min-w-0 rounded-xl border border-white/10 bg-[#080e15] px-3 py-2 text-sm"
            />
</label>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="theme-primary-button min-h-11 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? 'Saving...' : fixture.scheduledAt
                ? 'Reschedule'
                : 'Schedule'}
            </button>

            {fixture.scheduledAt ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void action(
                    'postpone',
                  )
                }
                className="rounded-xl border border-amber-400/20 px-4 py-2 text-sm font-bold text-amber-300"
              >
                Postpone
              </button>
            ) : null}

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void action(
                  'cancel',
                )
              }
              className="rounded-xl border border-red-400/20 px-4 py-2 text-sm font-bold text-red-300"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </article>
  );
}
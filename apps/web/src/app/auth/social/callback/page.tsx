'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { apiRequest } from '@/lib/api';
import { establishLoginSession, type CurrentUser } from '@/lib/auth-client';
import { applyThemePreference } from '@/lib/theme';
import { signedInDestination } from '@/lib/required-profile';
import { takeSocialAttempt, nativeSocialReturn } from '@/lib/social-auth';
import { todayForBirthDate } from '@/lib/date-of-birth';

type Session = {
  kind: 'session';
  accessToken: string;
  expiresIn: number;
  user: CurrentUser;
};
type Pending = {
  kind: 'register' | 'connect';
  ticket: string;
  profile: { fullName: string; email: string; provider: 'google' | 'facebook' };
};
type Outcome =
  | { data: Session | Pending; invite: string }
  | { external: string }
  | { error: string };

async function receive(): Promise<Outcome> {
  const params = new URLSearchParams(window.location.search),
    code = params.get('code') ?? '',
    state = params.get('state') ?? '';
  history.replaceState(null, '', '/auth/social/callback');
  if (params.has('error'))
    return {
      error:
        params.get('error') === 'cancelled'
          ? 'Sign-in was cancelled. You can try again.'
          : 'Sign-in could not be verified. Please start again.',
    };
  if (!/^[A-Za-z0-9_-]{43}$/.test(code) || !/^[A-Za-z0-9_-]{43}$/.test(state))
    return { error: 'This sign-in link is incomplete. Please start again.' };
  const attempt = takeSocialAttempt(state);
  if (!attempt) {
    const external = /Android/i.test(navigator.userAgent)
      ? nativeSocialReturn(code, state)
      : null;
    return external
      ? { external }
      : {
          error:
            'Start sign-in again in this tab. The original sign-in session is missing or expired.',
        };
  }
  const result = await apiRequest<{ data: Session | Pending }>(
    '/auth/social/exchange',
    {
      method: 'POST',
      body: JSON.stringify({ code, state, verifier: attempt.verifier }),
    },
  );
  return { data: result.data, invite: attempt.invite };
}

export default function SocialCallbackPage() {
  const router = useRouter(),
    operation = useRef<Promise<Outcome> | null>(null),
    [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState(''),
    [external, setExternal] = useState(''),
    [invite, setInvite] = useState(''),
    [busy, setBusy] = useState(false);
  function finish(data: Session, search: string) {
    establishLoginSession(data.accessToken, data.expiresIn);
    applyThemePreference(data.user.themePreference);
    router.replace(signedInDestination(data.user, search));
  }
  useEffect(() => {
    let active = true;
    operation.current ??= receive();
    void operation.current
      .then((outcome) => {
        if (!active) return;
        if ('error' in outcome) setError(outcome.error);
        else if ('external' in outcome) setExternal(outcome.external);
        else {
          setInvite(outcome.invite);
          if (outcome.data.kind === 'session')
            finish(outcome.data, outcome.invite);
          else setPending(outcome.data);
        }
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : 'Could not complete sign-in. Please retry.',
          );
      });
    return () => {
      active = false;
    };
    // The stored operation is one-use and must survive React's strict effect replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) return;
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body =
      pending.kind === 'connect'
        ? { ticket: pending.ticket, password: form.get('password') }
        : {
            ticket: pending.ticket,
            fullName: form.get('fullName'),
            inGameName: form.get('inGameName'),
            dateOfBirth: form.get('dateOfBirth'),
            phoneNumber: form.get('phoneNumber'),
          };
    try {
      const response = await apiRequest<{ data: Session }>(
        `/auth/social/${pending.kind === 'connect' ? 'connect' : 'register'}`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      finish(response.data, invite);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not complete your account. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthCard
      eyebrow="PLAYER ACCESS"
      title={
        pending?.kind === 'register'
          ? 'Complete your player account'
          : pending?.kind === 'connect'
            ? 'Connect your existing account'
            : 'Completing sign-in'
      }
      description={
        pending?.kind === 'connect'
          ? 'Confirm your FC ARENA password to connect this sign-in securely.'
          : pending?.kind === 'register'
            ? 'Your date of birth, WhatsApp number and In-Game Name are required.'
            : 'Keep this page open while we complete your sign-in.'
      }
    >
      {external ? (
        <div className="space-y-4">
          <p>Return to the FC ARENA app where you started sign-in.</p>
          <a
            className="primary-button flex min-h-12 items-center justify-center"
            href={external}
          >
            Open FC ARENA app
          </a>
        </div>
      ) : null}
      {!pending && !error && !external ? (
        <p role="status">Verifying your sign-in...</p>
      ) : null}
      {pending ? (
        <form onSubmit={submit} className="auth-form">
          <p className="theme-muted break-words text-sm">
            {pending.profile.email}
          </p>
          {pending.kind === 'connect' ? (
            <div className="field">
              <label htmlFor="social-password">FC ARENA password</label>
              <input
                id="social-password"
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={256}
                required
              />
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="social-name">Full name</label>
                <input
                  id="social-name"
                  name="fullName"
                  autoComplete="name"
                  defaultValue={pending.profile.fullName}
                  minLength={2}
                  maxLength={120}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="social-ign">In-Game Name</label>
                <input
                  id="social-ign"
                  name="inGameName"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="social-dob">Date of birth</label>
                <input
                  id="social-dob"
                  name="dateOfBirth"
                  type="date"
                  autoComplete="bday"
                  min="1900-01-01"
                  max={todayForBirthDate()}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="social-whatsapp">WhatsApp number</label>
                <input
                  id="social-whatsapp"
                  name="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  minLength={8}
                  maxLength={30}
                  required
                />
              </div>
              <p className="theme-muted text-xs leading-5">
                These details stay private. Sharing a WhatsApp contact with
                other players remains a separate choice.
              </p>
            </>
          )}
          <button type="submit" className="primary-button" disabled={busy}>
            {busy
              ? 'Completing sign-in...'
              : pending.kind === 'connect'
                ? 'Confirm and sign in'
                : 'Create account and continue'}
          </button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      ) : null}
      <Link
        href={'/login' + invite}
        className="text-link mt-5 inline-flex min-h-11 items-center"
      >
        Back to sign in
      </Link>
    </AuthCard>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FormEvent,
  useState,
} from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { apiRequest } from '@/lib/api';
import {
  establishLoginSession,
} from '@/lib/auth-client';
import {
  applyThemePreference,
  type ThemePreference,
} from '@/lib/theme';

function initialRegistrationNotice(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return sessionStorage.getItem('fc_auth_registration_notice') ?? '';
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialRegistrationNotice);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(event.currentTarget);

    const identifier =
      String(
        form.get(
          'identifier',
        ) ?? '',
      )
        .normalize(
          'NFKC',
        )
        .replace(
          /[\u200B-\u200D\uFEFF]/g,
          '',
        )
        .trim();

    try {
      const response =
        await apiRequest<{
          success: true;
          data: {
            accessToken: string;
            expiresIn: number;

            user: {
              themePreference:
                ThemePreference;
            };
          };
          error: null;
        }>(
          '/auth/login',
          {
            method:
              'POST',
            body:
              JSON.stringify({
                identifier,
                password:
                  String(
                    form.get(
                      'password',
                    ) ?? '',
                  ),
              }),
            timeoutMs:
              10_000,
          },
        );

      establishLoginSession(
        response.data.accessToken,
        response.data.expiresIn,
      );

      applyThemePreference(
        response.data.user
          .themePreference,
      );

      router.replace(
        '/dashboard',
      );
      sessionStorage.removeItem(
        'fc_auth_registration_notice',
      );

      setNotice('');

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Login failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow="PLAYER ACCESS"
      title="WELCOME BACK"
      description="Sign in with your email or In-Game Name to continue your FC ARENA career."
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label>Email or Game Name</label>
          <input
            name="identifier"
            type="text"
            inputMode="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="you@example.com or your IGN"
            required
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Use either your registered email address or the In-Game Name saved in your FC ARENA profile.
          </p>
        </div>

        <div className="field">
          <label>Password</label>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              style={{ paddingRight: '5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-sky-500 transition hover:text-sky-300"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {notice ? (
          <div className="success-box">
            {notice}
          </div>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}

        <button
          className="primary-button"
          type="submit"
          disabled={
            loading
          }
          aria-busy={
            loading
          }
        >
          <span className="login-button-content">
            {loading ? (
              <>
                <span
                  className="login-spinner"
                  aria-hidden="true"
                />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </span>
        </button>
      </form>

      <div className="link-row">
        <Link className="text-link" href="/forgot-password">
          Forgot password?
        </Link>
      </div>

      <div className="link-row">
        New player?{' '}
        <Link className="text-link" href="/register">
          Create account
        </Link>
      </div>
    </AuthCard>
  );
}
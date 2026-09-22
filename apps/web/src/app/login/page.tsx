'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { apiRequest } from '@/lib/api';
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

    const email =
      String(
        form.get(
          'email',
        ) ?? '',
      )
        .trim()
        .toLowerCase();

    try {
      const response =
        await apiRequest<{
          success: true;
          data: {
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
                email,
                password:
                  String(
                    form.get(
                      'password',
                    ) ?? '',
                  ),
              }),
          },
        );

      applyThemePreference(
        response.data.user
          .themePreference,
      );

      router.push(
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
      title="Welcome back"
      description="Sign in to continue your FC ARENA career."
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label>Email</label>
          <input name="email" type="email" required />
        </div>

        <div className="field">
          <label>Password</label>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
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
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
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
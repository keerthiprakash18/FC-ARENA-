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

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(event.currentTarget);

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
                email:
                  String(
                    form.get(
                      'email',
                    ) ?? '',
                  ),
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
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
          <input name="password" type="password" required />
        </div>

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
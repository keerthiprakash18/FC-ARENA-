'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { apiRequest } from '@/lib/api';

interface RegisterResponse {
  success: true;
  data: {
    message: string;
    player: {
      playerCode: string;
    };
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(event.currentTarget);

    const payload = {
      fullName: String(form.get('fullName') ?? ''),
      email: String(form.get('email') ?? '')
        .trim()
        .toLowerCase(),
      phoneNumber: String(form.get('phoneNumber') ?? '') || undefined,
      inGameName: String(form.get('inGameName') ?? ''),
      gameUid: String(form.get('gameUid') ?? '') || undefined,
      password: String(form.get('password') ?? ''),
      confirmPassword: String(form.get('confirmPassword') ?? ''),
    };

    try {
      const result = await apiRequest<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      sessionStorage.setItem(
        'fc_auth_registration_notice',
        result.data.message,
      );

      router.push('/login');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Registration failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow="PLAYER REGISTRATION"
      title="Join FC ARENA"
      description="Create your permanent FC ARENA player identity."
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label>Full Name</label>
          <input name="fullName" required />
        </div>

        <div className="field">
          <label>Email</label>
          <input name="email" type="email" required />
        </div>

        <div className="form-grid">
          <div className="field">
            <label>In-Game Name</label>
            <input name="inGameName" required />
          </div>

          <div className="field">
            <label>Game UID</label>
            <input name="gameUid" />
          </div>
        </div>

        <div className="field">
          <label>Phone Number — optional</label>
          <input name="phoneNumber" />
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Password</label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
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

          <div className="field">
            <label>Confirm Password</label>
            <div className="relative">
              <input
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                style={{ paddingRight: '5rem' }}
              />
              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword((value) => !value)
                }
                aria-pressed={showConfirmPassword}
                aria-label={
                  showConfirmPassword
                    ? 'Hide confirm password'
                    : 'Show confirm password'
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-sky-500 transition hover:text-sky-300"
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        <button
          className="primary-button"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Creating player...' : 'Create Player Account'}
        </button>
      </form>

      <div className="link-row">
        Already registered?{' '}
        <Link className="text-link" href="/login">
          Sign in
        </Link>
      </div>
    </AuthCard>
  );
}
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { apiRequest } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : sessionStorage.getItem('fc_reset_email') ?? '',
  );
  const [otp, setOtp] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : sessionStorage.getItem('fc_reset_dev_otp') ?? '',
  );
  const [devOtp] = useState(() =>
    typeof window === 'undefined'
      ? ''
      : sessionStorage.getItem('fc_reset_dev_otp') ?? '',
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(event.currentTarget);

    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          otp,
          newPassword: String(form.get('newPassword') ?? ''),
          confirmPassword: String(
            form.get('confirmPassword') ?? '',
          ),
        }),
      });

      sessionStorage.removeItem('fc_reset_email');
      sessionStorage.removeItem('fc_reset_dev_otp');

      router.push('/login');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Password reset failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow="SECURE RESET"
      title="Choose a new password"
      description="Verify the reset code and secure your account with a new password."
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label>Email</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
          />
        </div>

        <div className="field">
          <label>6-digit OTP</label>
          <input
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            maxLength={6}
            required
          />
        </div>

        {devOtp ? (
          <div className="dev-otp">
            DEVELOPMENT OTP: {devOtp}
          </div>
        ) : null}

        <div className="field">
          <label>New Password</label>
          <div className="relative">
            <input
              name="newPassword"
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

        {error ? <div className="error-box">{error}</div> : null}

        <button
          className="primary-button"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>

      <div className="link-row">
        <Link className="text-link" href="/login">
          Return to login
        </Link>
      </div>
    </AuthCard>
  );
}
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { apiRequest } from '@/lib/api';

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = sessionStorage.getItem('fc_auth_email') ?? '';
    const savedOtp = sessionStorage.getItem('fc_auth_dev_otp') ?? '';

    setEmail(savedEmail);
    setOtp(savedOtp);
    setDevOtp(savedOtp);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiRequest('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });

      sessionStorage.removeItem('fc_auth_dev_otp');
      router.push('/login');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Verification failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    setMessage('');

    try {
      const result = await apiRequest<{
        data: {
          developmentOtp?: string;
          message: string;
        };
      }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      setMessage(result.data.message);

      if (result.data.developmentOtp) {
        setDevOtp(result.data.developmentOtp);
        setOtp(result.data.developmentOtp);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to resend OTP.',
      );
    }
  }

  return (
    <AuthCard
      eyebrow="ACCOUNT VERIFICATION"
      title="Verify your email"
      description="Enter the six-digit verification code to activate your FC ARENA account."
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label>6-digit OTP</label>
          <input
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            inputMode="numeric"
            maxLength={6}
            required
          />
        </div>

        {devOtp ? (
          <div className="dev-otp">
            DEVELOPMENT OTP: {devOtp}
          </div>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}
        {message ? (
          <div className="success-box">{message}</div>
        ) : null}

        <button
          className="primary-button"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Verifying...' : 'Verify Account'}
        </button>

        <button
          className="secondary-button"
          type="button"
          onClick={resend}
        >
          Resend OTP
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
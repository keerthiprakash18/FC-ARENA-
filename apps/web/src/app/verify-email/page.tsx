'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
  AuthCard,
} from '@/components/auth/auth-card';


export default function VerifyEmailPage() {
  const router =
    useRouter();

  useEffect(
    () => {
      sessionStorage.removeItem(
        'fc_auth_email',
      );

      sessionStorage.removeItem(
        'fc_auth_dev_otp',
      );

      sessionStorage.removeItem(
        'fc_auth_otp_sent_at',
      );

      sessionStorage.removeItem(
        'fc_auth_verification_notice',
      );

      router.replace(
        '/login',
      );
    },
    [
      router,
    ],
  );

  return (
    <AuthCard
      eyebrow="ACCOUNT READY"
      title="Email verification is not required"
      description="FC ARENA accounts can sign in immediately after registration. Redirecting you to sign in."
    >
      <div className="success-box">
        Your account does not need an email OTP.
      </div>
    </AuthCard>
  );
}

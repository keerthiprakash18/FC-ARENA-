'use client';

import { useEffect } from 'react';
import { FcErrorState } from '@/components/fc/fc-ui';

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(
      'FC ARENA route error',
      error.digest ?? error.name,
    );
  }, [error]);

  return (
    <main className="fc-state-screen">
      <section>
        <FcErrorState title="FC ARENA could not load this screen" message="Your data was not submitted again. Check your connection and retry the page." onRetry={retry} />
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="/dashboard"
            className="theme-secondary-button inline-flex min-h-11 items-center rounded-[10px] border px-5 text-sm font-semibold"
          >
            Go to Dashboard
          </a>
        </div>
      </section>
    </main>
  );
}

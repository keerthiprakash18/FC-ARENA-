'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      'FC ARENA route error',
      error.digest ?? error.name,
    );
  }, [error]);

  return (
    <main className="theme-app-background grid min-h-screen place-items-center p-6">
      <section
        role="alert"
        className="theme-panel w-full max-w-lg rounded-2xl border p-6 text-center"
      >
        <h1 className="theme-text text-xl font-semibold">
          FC ARENA could not load this screen
        </h1>
        <p className="theme-secondary-text mt-3 text-sm leading-6">
          Your data was not submitted again. Check your connection and retry the page.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="theme-primary-button min-h-11 rounded-[10px] px-5 text-sm font-semibold"
          >
            Try again
          </button>
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

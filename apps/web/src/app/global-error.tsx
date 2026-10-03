'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            background: '#071525',
            color: '#ffffff',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <section style={{ maxWidth: 520, textAlign: 'center' }} role="alert">
            <h1>FC ARENA is temporarily unavailable</h1>
            <p style={{ lineHeight: 1.6, color: '#b7c4d3' }}>
              No action will be submitted again automatically. Retry, or reopen FC ARENA after checking your connection.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 18,
                minHeight: 44,
                border: 0,
                borderRadius: 10,
                padding: '0 20px',
                fontWeight: 700,
              }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}

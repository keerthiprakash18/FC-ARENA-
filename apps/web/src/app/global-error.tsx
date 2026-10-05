'use client';

import { FcErrorState } from '@/components/fc/fc-ui';
import './globals.css';
import './design-tokens.css';
import './modernization.css';
import './native-android.css';

export default function GlobalError({ retry }: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en" data-theme="luxury-gold" data-mode="light">
      <body>
        <main className="fc-state-screen">
          <FcErrorState
            title="FC ARENA is temporarily unavailable"
            message="No action will be submitted again automatically. Check your connection and try again."
            onRetry={retry}
          />
        </main>
      </body>
    </html>
  );
}

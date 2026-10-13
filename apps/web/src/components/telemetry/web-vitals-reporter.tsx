'use client';

import {
  useReportWebVitals,
} from 'next/web-vitals';

const supportedMetrics =
  new Set([
    'CLS',
    'FCP',
    'INP',
    'LCP',
    'TTFB',
  ]);

export function WebVitalsReporter() {
  useReportWebVitals(
    (metric) => {
      if (
        !supportedMetrics.has(
          metric.name,
        )
      ) {
        return;
      }

      void fetch(
        '/api/telemetry/web-vitals',
        {
          method: 'POST',
          credentials: 'omit',
          keepalive: true,
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name: metric.name,
            value: metric.value,
            rating: metric.rating,
          }),
        },
      ).catch(
        () => undefined,
      );
    },
  );

  return null;
}

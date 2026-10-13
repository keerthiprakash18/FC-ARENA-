import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  TelemetryService,
} from './telemetry.service.js';

describe(
  'TelemetryService',
  () => {
    it(
      'reports real API percentiles from bounded samples',
      () => {
        const service =
          new TelemetryService();

        for (
          const value
          of [10, 20, 30, 40, 50]
        ) {
          service.recordApiLatency(
            value,
          );
        }

        expect(
          service.snapshot()
            .api,
        ).toMatchObject({
          samples: 5,
          p50: 30,
          p75: 40,
          p95: 50,
        });
      },
    );

    it(
      'keeps web vital metrics separated',
      () => {
        const service =
          new TelemetryService();

        service.recordWebVital(
          'LCP',
          2100,
        );
        service.recordWebVital(
          'CLS',
          0.08,
        );

        const snapshot =
          service.snapshot();

        expect(
          snapshot.webVitals.LCP,
        ).toMatchObject({
          samples: 1,
          p75: 2100,
          unit: 'ms',
        });
        expect(
          snapshot.webVitals.CLS,
        ).toMatchObject({
          samples: 1,
          p75: 0.08,
          unit: 'score',
        });
      },
    );

    it(
      'ignores invalid samples',
      () => {
        const service =
          new TelemetryService();

        service.recordApiLatency(
          Number.NaN,
        );
        service.recordApiLatency(
          -1,
        );
        service.recordWebVital(
          'UNKNOWN',
          10,
        );

        expect(
          service.snapshot()
            .api.samples,
        ).toBe(0);
      },
    );
  },
);

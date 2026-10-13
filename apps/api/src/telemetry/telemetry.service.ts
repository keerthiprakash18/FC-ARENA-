import {
  Injectable,
} from '@nestjs/common';

const MAX_SAMPLES =
  500;

const WEB_VITAL_NAMES = [
  'CLS',
  'FCP',
  'INP',
  'LCP',
  'TTFB',
] as const;

type WebVitalName =
  (typeof WEB_VITAL_NAMES)[number];

type Summary = {
  samples: number;
  p50: number | null;
  p75: number | null;
  p95: number | null;
};

@Injectable()
export class TelemetryService {
  private readonly apiLatencySamples:
    number[] =
    [];

  private readonly webVitalSamples =
    new Map<
      WebVitalName,
      number[]
    >(
      WEB_VITAL_NAMES.map(
        (name) => [
          name,
          [],
        ],
      ),
    );

  recordApiLatency(
    durationMs: number,
  ): void {
    this.push(
      this.apiLatencySamples,
      durationMs,
    );
  }

  recordWebVital(
    name: string,
    value: number,
  ): void {
    if (
      !WEB_VITAL_NAMES.includes(
        name as WebVitalName,
      )
    ) {
      return;
    }

    const samples =
      this.webVitalSamples.get(
        name as WebVitalName,
      );

    if (!samples) return;

    this.push(
      samples,
      value,
    );
  }

  snapshot() {
    return {
      scope:
        'current-api-instance',
      api: {
        ...this.summarize(
          this.apiLatencySamples,
        ),
        unit: 'ms',
      },
      webVitals:
        Object.fromEntries(
          WEB_VITAL_NAMES.map(
            (name) => [
              name,
              {
                ...this.summarize(
                  this.webVitalSamples.get(
                    name,
                  ) ?? [],
                ),
                unit:
                  name === 'CLS'
                    ? 'score'
                    : 'ms',
              },
            ],
          ),
        ),
    };
  }

  private push(
    target: number[],
    value: number,
  ): void {
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 120_000
    ) {
      return;
    }

    target.push(
      Number(
        value.toFixed(2),
      ),
    );

    if (
      target.length >
      MAX_SAMPLES
    ) {
      target.splice(
        0,
        target.length -
          MAX_SAMPLES,
      );
    }
  }

  private summarize(
    samples: number[],
  ): Summary {
    if (
      samples.length ===
      0
    ) {
      return {
        samples: 0,
        p50: null,
        p75: null,
        p95: null,
      };
    }

    const ordered =
      [...samples].sort(
        (a, b) =>
          a - b,
      );

    return {
      samples:
        ordered.length,
      p50:
        this.percentile(
          ordered,
          0.5,
        ),
      p75:
        this.percentile(
          ordered,
          0.75,
        ),
      p95:
        this.percentile(
          ordered,
          0.95,
        ),
    };
  }

  private percentile(
    ordered: number[],
    percentile: number,
  ): number {
    const index =
      Math.min(
        ordered.length -
          1,
        Math.max(
          0,
          Math.ceil(
            ordered.length *
              percentile,
          ) - 1,
        ),
      );

    return ordered[
      index
    ];
  }
}

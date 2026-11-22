import { describe, expect, it } from 'vitest';
import { ExternalCircuitBreaker, ExternalCircuitOpenError } from './external-circuit.js';

describe('external dependency circuit', () => {
  it('isolates providers, fails fast during cooldown and admits only one recovery probe', () => {
    let now = 100;
    const breaker = new ExternalCircuitBreaker(2, 1000, () => now);
    for (let i = 0; i < 2; i++) breaker.complete(breaker.acquire('mail'), 'failure');
    expect(() => breaker.acquire('mail')).toThrow(ExternalCircuitOpenError);
    expect(() => breaker.acquire('images')).not.toThrow();
    now += 1000;
    const probe = breaker.acquire('mail');
    expect(() => breaker.acquire('mail')).toThrow(ExternalCircuitOpenError);
    breaker.complete(probe, 'success');
    expect(() => breaker.acquire('mail')).not.toThrow();
  });

  it('ignores old in-flight success, renews a failed probe cooldown and releases cancelled probes', () => {
    let now = 0;
    const breaker = new ExternalCircuitBreaker(1, 1000, () => now);
    const old = breaker.acquire('provider');
    breaker.complete(breaker.acquire('provider'), 'failure');
    breaker.complete(old, 'success');
    expect(() => breaker.acquire('provider')).toThrow(ExternalCircuitOpenError);
    now = 1000;
    breaker.complete(breaker.acquire('provider'), 'failure');
    now = 1500;
    expect(() => breaker.acquire('provider')).toThrow(ExternalCircuitOpenError);
    now = 2000;
    breaker.complete(breaker.acquire('provider'), 'cancelled');
    const probe = breaker.acquire('provider');
    breaker.complete(probe, 'success');
    expect(() => breaker.acquire('provider')).not.toThrow();
  });

  it('counts consecutive dependency failures, excluding caller cancellations', () => {
    const breaker = new ExternalCircuitBreaker(2);
    breaker.complete(breaker.acquire('provider'), 'failure');
    breaker.complete(breaker.acquire('provider'), 'success');
    breaker.complete(breaker.acquire('provider'), 'failure');
    breaker.complete(breaker.acquire('provider'), 'cancelled');
    expect(() => breaker.acquire('provider')).not.toThrow();
    breaker.complete(breaker.acquire('provider'), 'failure');
    expect(() => breaker.acquire('provider')).toThrow(ExternalCircuitOpenError);
  });
});

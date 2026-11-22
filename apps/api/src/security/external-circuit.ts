type Circuit = { failures: number; openedAt: number | null; generation: number; probing: boolean };
type Permit = { circuit: Circuit; generation: number };

export class ExternalCircuitOpenError extends Error {
  constructor() {
    super('External service is temporarily unavailable. Please retry later.');
    this.name = 'ExternalCircuitOpenError';
  }
}

// Each provider has its own circuit. This bounds outage traffic in one API
// process; it does not retry writes or replace distributed request limits.
export class ExternalCircuitBreaker {
  private readonly circuits = new Map<string, Circuit>();

  constructor(
    private readonly threshold = 5,
    private readonly cooldownMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  acquire(origin: string): Permit {
    let circuit = this.circuits.get(origin);
    if (!circuit) {
      // Provider URLs are server configured. Still cap process memory if a
      // future caller starts accepting arbitrary origins.
      if (this.circuits.size >= 100) this.circuits.delete(this.circuits.keys().next().value!);
      circuit = { failures: 0, openedAt: null, generation: 0, probing: false };
      this.circuits.set(origin, circuit);
    }
    if (circuit.openedAt !== null) {
      if (this.now() - circuit.openedAt < this.cooldownMs || circuit.probing) {
        throw new ExternalCircuitOpenError();
      }
      circuit.probing = true;
    }
    return { circuit, generation: circuit.generation };
  }

  complete(permit: Permit, outcome: 'success' | 'failure' | 'cancelled'): void {
    const { circuit, generation } = permit;
    // An old in-flight success must not reopen a circuit after newer failures.
    if (generation !== circuit.generation) return;
    if (outcome === 'cancelled') {
      circuit.probing = false;
      return;
    }
    if (outcome === 'success') {
      circuit.failures = 0;
      circuit.openedAt = null;
      circuit.probing = false;
      return;
    }
    circuit.failures += 1;
    if (circuit.probing || circuit.failures >= this.threshold) {
      circuit.openedAt = this.now();
      circuit.probing = false;
      circuit.generation += 1;
    }
  }
}

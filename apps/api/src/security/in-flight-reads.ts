/** Coalesce concurrent reads only; completed values are never cached. */
export class InFlightReads {
  private readonly pending = new Map<string, Promise<unknown>>();
  run<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    if (this.pending.size >= 256) return load();
    const result = load();
    this.pending.set(key, result);
    const release = () => { if (this.pending.get(key) === result) this.pending.delete(key); };
    void result.then(release, release);
    return result;
  }
}

/** Keep recognition running while ordered, authoritative receipts arrive. */
export class UnitQueue<T> {
  private entries: { value: T; settle: (accepted: boolean) => void }[] = [];
  private generation = 0;
  private running = false;
  private waiters: (() => void)[] = [];
  flush(): Promise<void> {
    return this.size
      ? new Promise((resolve) => this.waiters.push(resolve))
      : Promise.resolve();
  }
  private notifyIdle() {
    if (!this.size) this.waiters.splice(0).forEach((resolve) => resolve());
  }
  constructor(
    private deliver: (value: T) => void | boolean | Promise<boolean>,
    readonly limit = 8,
  ) {}
  get size() {
    return this.entries.length;
  }
  reset() {
    this.generation++;
    this.entries = [];
    this.running = false;
    this.notifyIdle();
  }
  push(value: T, settle: (accepted: boolean) => void) {
    if (this.size >= this.limit) return false;
    this.entries.push({ value, settle });
    void this.drain();
    return true;
  }
  private async drain() {
    if (this.running) return;
    this.running = true;
    const generation = this.generation;
    while (this.entries.length && generation === this.generation) {
      const entry = this.entries[0];
      let accepted = false;
      try {
        accepted = (await this.deliver(entry.value)) !== false;
      } catch {
        /* reported by receipt */
      }
      if (generation !== this.generation) return;
      this.entries.shift();
      // A rejected unit invalidates subsequent speculative side/progress state.
      if (!accepted) this.reset();
      entry.settle(accepted);
      if (!accepted) return;
    }
    if (generation === this.generation) {
      this.running = false;
      this.notifyIdle();
    }
  }
}

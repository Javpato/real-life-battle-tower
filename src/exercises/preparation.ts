/** Repositioning uses wall time; stable posture uses consecutive fresh camera frames. */
export class RecalibrationGate {
  private deadline = 0;
  private stableAt: number | null = null;
  private previous: number | null = null;
  active = false;
  start(now: number) {
    this.deadline = now + 5000;
    this.stableAt = this.previous = null;
    this.active = true;
  }
  cancel() {
    this.active = false;
    this.stableAt = this.previous = null;
  }
  remaining(now: number) {
    return Math.max(0, Math.ceil((this.deadline - now) / 1000));
  }
  observe(ready: boolean, fresh: boolean, timestamp: number, now: number) {
    if (!this.active || this.remaining(now)) return false;
    const gap = this.previous === null ? 0 : timestamp - this.previous;
    this.previous = timestamp;
    if (
      !ready ||
      !fresh ||
      !Number.isFinite(timestamp) ||
      gap < 0 ||
      gap > 400
    ) {
      this.stableAt = null;
      return false;
    }
    this.stableAt ??= timestamp;
    if (timestamp - this.stableAt < 1000) return false;
    this.active = false;
    return true;
  }
}

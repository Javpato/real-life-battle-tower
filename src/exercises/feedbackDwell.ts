/** Presentation-only dwell. Detector state and credit decisions never wait for text. */
export class FeedbackDwell {
  private shown = "";
  private status = "";
  private candidate = "";
  private since = 0;
  update(message: string, status: string, now: number) {
    const urgent = [
      "off",
      "loading",
      "error",
      "paused",
      "no-body",
      "countdown",
      "recalibrating",
      "valid",
    ].includes(status);
    const phaseChange =
      status !== this.status &&
      ![
        "partial",
        "insufficient",
        "ready",
        "incomplete",
        "validating",
      ].includes(status);
    if (!this.shown || urgent || phaseChange) {
      this.shown = message;
      this.candidate = message;
      this.since = now;
    } else if (message !== this.candidate) {
      this.candidate = message;
      this.since = now;
    } else if (now - this.since >= 800) this.shown = message;
    this.status = status;
    return this.shown;
  }
}

import type { ExerciseVisualState } from "../exercises/exerciseUi";
export type CueSnapshot = {
  progress: number;
  target: number;
  nextSide?: "left" | "right";
  status: ExerciseVisualState;
  message: string;
  active: boolean;
  complete?: boolean;
  seconds: boolean;
  countdown?: number;
};
export type ExerciseCue = {
  kind: "rep" | "ready" | "lost" | "complete" | "guidance";
  speech: string;
};
/** Presentation-only cue policy. It never awards units or affects combat. */
export class ExerciseCuePlanner {
  private progress: number;
  private finished = false;
  private lossSince?: number;
  private lossAnnounced = false;
  private readyAnnounced = false;
  private lastGuidance = -Infinity;
  private lastInstruction = "";
  private candidateInstruction = "";
  private candidateSince = 0;
  private lastCountdown?: number;
  private previousStatus?: ExerciseVisualState;
  constructor(progress = 0) {
    this.progress = progress;
  }
  update(s: CueSnapshot, now: number): ExerciseCue[] {
    const cues: ExerciseCue[] = [];
    if (s.progress < this.progress) {
      this.finished = false;
      this.readyAnnounced = false;
    }
    if (s.progress > this.progress) {
      cues.push({
        kind: "rep",
        speech: `${s.progress}${s.seconds ? " seconds" : ""}.${s.nextSide ? ` Next, ${s.nextSide} ${s.seconds ? "side" : "side"}.` : ""}`,
      });
    }
    this.progress = s.progress;
    if (
      (s.complete || s.progress >= s.target) &&
      s.target > 0 &&
      !this.finished
    ) {
      this.finished = true;
      cues.push({ kind: "complete", speech: "Series complete. You can rest." });
    }
    if (s.status === "ready" && s.active && !this.readyAnnounced) {
      this.readyAnnounced = true;
      cues.push({
        kind: "ready",
        speech: s.message || "Starting position recognized. Get ready.",
      });
    }
    if (
      s.active &&
      s.status === "countdown" &&
      s.countdown !== undefined &&
      s.countdown !== this.lastCountdown
    ) {
      cues.push({
        kind: "guidance",
        speech: s.countdown > 0 ? String(s.countdown) : "Begin.",
      });
      this.lastCountdown = s.countdown;
    } else if (s.status !== "countdown") this.lastCountdown = undefined;
    if (
      s.active &&
      s.status === "recalibrating" &&
      this.previousStatus !== "recalibrating"
    )
      cues.push({
        kind: "guidance",
        speech:
          "Prepare to recalibrate. Move back into position. You have five seconds.",
      });
    this.previousStatus = s.status;
    const lost =
      s.active &&
      ["no-body", "partial", "insufficient", "error"].includes(s.status);
    if (lost) {
      this.lossSince ??= now;
      if (now - this.lossSince >= 3000 && !this.lossAnnounced) {
        this.lossAnnounced = true;
        cues.push({
          kind: "lost",
          speech: s.message || "Adjust the camera. Your progress is safe.",
        });
      }
    } else {
      this.lossSince = undefined;
      this.lossAnnounced = false;
    }
    // A changed correction is useful even during a long loss episode. Require a
    // stable instruction and a quiet interval so landmark jitter cannot nag.
    const instruction = s.message.trim();
    if (instruction !== this.candidateInstruction) {
      this.candidateInstruction = instruction;
      this.candidateSince = now;
    }
    const guidanceState = [
      "off",
      "loading",
      "countdown",
      "recalibrating",
      "moving",
      "return",
      "hold",
      "partial",
      "insufficient",
      "no-body",
    ].includes(s.status);
    if (
      s.active &&
      (!lost || this.lossAnnounced) &&
      guidanceState &&
      instruction &&
      instruction !== this.lastInstruction &&
      now - this.candidateSince >= 800 &&
      now - this.lastGuidance >= 6000 &&
      !cues.length
    ) {
      cues.push({ kind: "guidance", speech: instruction });
    }
    if (cues.length) {
      this.lastGuidance = now;
      this.lastInstruction = instruction;
    }
    return cues;
  }
}
let context: AudioContext | undefined;
export function armExerciseAudio() {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    /* Silent fallback. */
  }
}
export function playExerciseCue(kind: ExerciseCue["kind"]) {
  try {
    if (!context || context.state !== "running") return;
    const notes =
      kind === "complete"
        ? [523, 659, 784]
        : kind === "rep"
          ? [660, 880]
          : kind === "ready"
            ? [440, 660]
            : [280];
    notes.forEach((frequency, i) => {
      const osc = context!.createOscillator(),
        gain = context!.createGain(),
        at = context!.currentTime + i * 0.1;
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.16, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
      osc.connect(gain);
      gain.connect(context!.destination);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(at);
      osc.stop(at + 0.17);
    });
  } catch {
    /* Audio failure never blocks movement. */
  }
}
export function speakExercise(text: string, interrupt = false) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (window.speechSynthesis.speaking && !interrupt) return;
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-US";
  speech.rate = 1.02;
  speech.volume = 1;
  const voices = window.speechSynthesis.getVoices(),
    voice =
      voices.find(
        (v) => v.lang.toLowerCase().startsWith("en") && v.localService,
      ) ?? voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  if (voice) speech.voice = voice;
  if (interrupt) window.speechSynthesis.cancel();
  window.speechSynthesis.speak(speech);
}
export function stopExerciseSpeech() {
  if (typeof window !== "undefined" && "speechSynthesis" in window)
    window.speechSynthesis.cancel();
}

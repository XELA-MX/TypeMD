/**
 * Mechanical-keyboard typing sounds, synthesized live with the Web Audio API.
 *
 * No audio files: every keystroke is built from a short band-passed noise
 * "click" plus a low sine "thock", shaped with an envelope. Small random
 * variation per press keeps it from sounding robotic, and space / enter /
 * backspace get their own voicing like a real board.
 */

export type SoundLevel = "soft" | "medium" | "loud";

const LEVEL_GAIN: Record<SoundLevel, number> = {
  soft: 0.3,
  medium: 0.6,
  loud: 1.0,
};

type KeyKind = "normal" | "space" | "enter" | "delete";

interface Voice {
  click: number; // bandpass center frequency (Hz)
  thock: number; // body resonance frequency (Hz)
  gain: number; // relative loudness
}

const VOICES: Record<KeyKind, Voice> = {
  normal: { click: 3000, thock: 185, gain: 1.0 },
  space: { click: 2100, thock: 130, gain: 1.3 },
  enter: { click: 1950, thock: 120, gain: 1.25 },
  delete: { click: 2600, thock: 160, gain: 0.95 },
};

const rand = (center: number, spread: number): number =>
  center * (1 + (Math.random() * 2 - 1) * spread);

export class KeySound {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private level: SoundLevel = "medium";

  setConfig(enabled: boolean, level: SoundLevel): void {
    this.enabled = enabled;
    this.level = level;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        LEVEL_GAIN[level],
        this.ctx.currentTime,
        0.01,
      );
    }
  }

  /** Lazily build the audio graph. Safe to call inside a keydown gesture. */
  private ensure(): boolean {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return true;
    }
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return false;

    const ctx = new Ctor();

    // One second of white noise, reused for every click.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Soft compressor on the bus so fast typing never clips harshly.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.attack.value = 0.002;
    comp.release.value = 0.1;

    const master = ctx.createGain();
    master.gain.value = LEVEL_GAIN[this.level];
    master.connect(comp).connect(ctx.destination);

    this.ctx = ctx;
    this.noise = buffer;
    this.master = master;
    return true;
  }

  private voiceFor(e: KeyboardEvent): KeyKind | null {
    if (e.ctrlKey || e.metaKey || e.altKey) return null; // it's a shortcut
    const k = e.key;
    if (k === " " || k === "Spacebar") return "space";
    if (k === "Enter") return "enter";
    if (k === "Backspace" || k === "Delete") return "delete";
    if (k === "Tab") return "normal";
    if (k.length === 1) return "normal"; // a printable character
    return null; // modifiers, arrows, F-keys, etc.
  }

  /** Play the appropriate click for a keydown event, if enabled. */
  play(e: KeyboardEvent): void {
    if (!this.enabled) return;
    const kind = this.voiceFor(e);
    if (!kind) return;
    if (!this.ensure() || !this.ctx || !this.noise || !this.master) return;

    const v = VOICES[kind];
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Slightly quieter on auto-repeat so held keys don't machine-gun.
    const repeatAtten = e.repeat ? 0.6 : 1;
    const g = v.gain * repeatAtten;

    // --- High "click": short band-passed noise burst ---
    const dur = rand(0.012, 0.2);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rand(1, 0.1);

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = rand(v.click, 0.12);
    bp.Q.value = 0.9;

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.9 * g, t);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(bp).connect(clickGain).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.01);

    // --- Low "thock": quick sine drop for body ---
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const f0 = rand(v.thock, 0.08);
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.07);

    const thockGain = ctx.createGain();
    thockGain.gain.setValueAtTime(0.0001, t);
    thockGain.gain.exponentialRampToValueAtTime(0.5 * g, t + 0.004);
    thockGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    osc.connect(thockGain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }
}

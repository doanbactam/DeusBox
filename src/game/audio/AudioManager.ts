/**
 * Programmatic audio using Web Audio API oscillators.
 * No external audio files needed — all sounds generated at runtime.
 */
export class AudioManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  /** Initialize the AudioContext on first user interaction. */
  init(): void {
    if (this.audioContext) return;
    try {
      this.audioContext = new AudioContext();
    } catch {
      console.warn('[AudioManager] Web Audio API not available');
    }
  }

  /** Short UI click beep (440Hz, 50ms). */
  playUIClick(): void {
    this.playTone(440, 0.05, 'square');
  }

  /** God power activation (200Hz, 100ms). */
  playGodPower(): void {
    this.playTone(200, 0.1, 'sawtooth');
  }

  /** Entity spawn ascending tone (300→600Hz, 150ms). */
  playEntitySpawn(): void {
    if (!this.enabled || !this.audioContext) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** Disaster: noise burst (100ms white noise). */
  playDisaster(): void {
    this.playNoise(0.1);
  }

  /** Combat: sharp click (800Hz, 30ms). */
  playCombat(): void {
    this.playTone(800, 0.03, 'square');
  }

  /** Button hover: very short high tone (800Hz, 20ms). */
  playButtonHover(): void {
    this.playTone(800, 0.02, 'sine');
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
    if (!this.enabled || !this.audioContext) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  private playNoise(duration: number): void {
    if (!this.enabled || !this.audioContext) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration);
  }

  private static instance: AudioManager | null = null;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }
}

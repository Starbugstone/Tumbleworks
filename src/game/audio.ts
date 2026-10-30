import { isMuted, setMuted } from './progress';

/** Every sound is synthesised, so there are no audio files to license or load. */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = isMuted();

  /** Browsers only allow audio after a user gesture, so call this from the first tap. */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const compressor = this.ctx.createDynamicsCompressor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(compressor).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    setMuted(this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
    return this.muted;
  }

  private tone(freq: number, duration: number, gain: number, delay = 0, type: OscillatorType = 'sine', slideTo?: number): void {
    if (!this.ctx || !this.master) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  /** Two inharmonic partials read as glass touching glass. */
  private clink(freq: number, gain: number, delay = 0): void {
    this.tone(freq, 0.09, gain, delay);
    this.tone(freq * 2.76, 0.05, gain * 0.45, delay);
  }

  tap(): void {
    this.tone(320, 0.06, 0.18, 0, 'triangle', 180);
  }

  release(): void {
    for (let i = 0; i < 6; i++) this.clink(1900 + i * 90, 0.07, i * 0.035);
  }

  enter(): void {
    this.clink(2300, 0.045);
  }

  deliver(slot: number): void {
    this.clink(1320 + slot * 260, 0.2);
    this.tone(260, 0.07, 0.14, 0, 'triangle', 150);
  }

  boxFilled(chain: number): void {
    const root = 523 * Math.pow(2, Math.min(chain, 7) / 12);
    [1, 1.25, 1.5].forEach((ratio, i) => this.tone(root * ratio, 0.26, 0.16, i * 0.05, 'triangle'));
  }

  blocked(): void {
    this.tone(150, 0.14, 0.3, 0, 'square', 90);
  }

  jam(): void {
    this.tone(330, 0.2, 0.22, 0, 'triangle', 240);
    this.tone(220, 0.34, 0.22, 0.16, 'triangle', 130);
  }

  undo(): void {
    this.tone(500, 0.14, 0.16, 0, 'sine', 900);
  }

  win(): void {
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      this.tone(freq, 0.3, 0.18, i * 0.09, 'triangle');
      this.clink(freq * 2, 0.05, i * 0.09);
    });
  }
}

export const sfx = new Sfx();

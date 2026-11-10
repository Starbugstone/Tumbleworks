import { isMuted, setMuted } from './progress';
import tap from './sounds/tap.mp3?no-inline';
import release from './sounds/release.mp3?no-inline';
import wood from './sounds/impact-wood.mp3?no-inline';
import glass from './sounds/impact-glass.mp3?no-inline';
import light from './sounds/landing-light.mp3?no-inline';
import final from './sounds/landing-final.mp3?no-inline';
import complete from './sounds/complete.mp3?no-inline';
import blocked from './sounds/blocked.mp3?no-inline';
import undo from './sounds/undo.mp3?no-inline';
import jam from './sounds/jam.mp3?no-inline';
import win from './sounds/win.mp3?no-inline';

const SOUNDS = { tap, release, wood, glass, light, final, complete, blocked, undo, jam, win };
type Cue = keyof typeof SOUNDS;

/** A small CC0 sample bank, loaded once after the player enables sound. See assets/audio/README.md. */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = isMuted();
  private loading: Promise<void> | null = null;
  private readonly buffers = new Map<Cue, AudioBuffer>();
  private readonly voices = new Set<AudioScheduledSourceNode>();
  private lastImpact = -Infinity;
  private impactCount = 0;

  /** Call from a gesture. Loading never delays the action, and old cues are never queued for later. */
  unlock(): void {
    if (this.muted) return;
    if (!this.ctx) {
      if (typeof AudioContext === 'undefined') return;
      try {
        this.ctx = new AudioContext();
        const compressor = this.ctx.createDynamicsCompressor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.8;
        this.master.connect(compressor).connect(this.ctx.destination);
      } catch { return; }
    }
    if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') void this.ctx.resume().catch(() => {});
    const context = this.ctx;
    this.loading ??= Promise.all((Object.keys(SOUNDS) as Cue[]).map(async cue => {
      try {
        const response = await fetch(SOUNDS[cue]);
        if (!response.ok) return;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(cue, buffer);
      } catch { /* A failed sample keeps its quiet fallback; it must not break the game or retry per tick. */ }
    })).then(() => {});
  }

  get isMuted(): boolean { return this.muted; }

  toggleMute(): boolean {
    this.muted = !this.muted;
    setMuted(this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
    if (this.muted) this.cancel(); else this.unlock();
    return this.muted;
  }

  private track(source: AudioScheduledSourceNode, envelope: GainNode): void {
    this.voices.add(source);
    source.connect(envelope).connect(this.master!);
    source.onended = () => { this.voices.delete(source); source.disconnect(); envelope.disconnect(); };
  }

  private play(cue: Cue, gain: number, rate = 1, reward = false): void {
    if (!this.ctx || !this.master || this.muted || this.ctx.state !== 'running') return;
    // Ordinary cues leave four voices for completion payoffs; a dense pour cannot drown them out.
    if (this.voices.size >= (reward ? 12 : 8)) return;
    const now = this.ctx.currentTime;
    const envelope = this.ctx.createGain();
    const buffer = this.buffers.get(cue);
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      envelope.gain.value = gain;
      this.track(source, envelope);
      source.start(now);
    } else {
      // Immediate first-touch/offline feedback. Replaced by the sample on subsequent actions, never late.
      const source = this.ctx.createOscillator();
      source.type = 'sine';
      source.frequency.setValueAtTime((reward ? 660 : 440) * rate, now);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * 0.12), now + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      this.track(source, envelope);
      source.start(now); source.stop(now + 0.06);
    }
  }

  /** Undo, restart, navigation and hidden/blurred pages discard all sound tails. */
  cancel(): void {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
    this.lastImpact = -Infinity;
  }

  tap(): void { this.play('tap', 0.55); }
  release(): void { this.play('release', 0.55); }

  impact(strength: number): void {
    if (!this.ctx || this.muted || this.ctx.currentTime - this.lastImpact < 0.065 || this.voices.size >= 4) return;
    this.lastImpact = this.ctx.currentTime;
    const weight = Math.max(0, Math.min(1, strength));
    this.play(this.impactCount++ % 4 === 3 ? 'glass' : 'wood', 0.06 + weight * 0.12, 0.96 + Math.random() * 0.08);
  }

  deliver(slot: number): void { this.play('light', 0.42, 2 ** (Math.min(slot, 4) / 12)); }

  landing(arrival: number): void {
    if (arrival < 3) this.play('light', arrival === 1 ? 0.42 : 0.48, arrival === 1 ? 1 : 2 ** (2 / 12));
    else {
      this.play('final', 0.8, 1, true);
      this.play('complete', 0.4, 1, true);
    }
  }

  boxFilled(chain: number): void { this.play('complete', 0.7, 2 ** (Math.min(chain, 7) / 12), true); }
  blocked(): void { this.play('blocked', 0.5, 0.9); }
  undo(): void { this.play('undo', 0.65); }
  jam(): void { this.cancel(); this.play('jam', 0.65, 0.9, true); }
  win(): void { this.cancel(); this.play('win', 0.95, 1, true); }
}

export const sfx = new Sfx();

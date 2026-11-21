import { isMuted, setMuted } from './progress';
import tap from './sounds/tap.mp3?no-inline';
import release from './sounds/release.mp3?no-inline';
import wood from './sounds/impact-wood.mp3?no-inline';
import glass from './sounds/impact-glass.mp3?no-inline';
import light from './sounds/landing-light.mp3?no-inline';
import final from './sounds/landing-final.mp3?no-inline';
import complete from './sounds/complete.mp3?no-inline';
import truck from './sounds/truck-complete.mp3?no-inline';
import harbourBell from './sounds/harbour-bell.mp3?no-inline';
import blocked from './sounds/blocked.mp3?no-inline';
import undo from './sounds/undo.mp3?no-inline';
import jam from './sounds/jam.mp3?no-inline';
import win from './sounds/win.mp3?no-inline';

const SOUNDS = { tap, release, wood, glass, light, final, complete, truck, harbourBell, blocked, undo, jam, win };
type Cue = keyof typeof SOUNDS;
type Timer = ReturnType<typeof setTimeout>;
type BedTheme = 'coast' | 'inland';
type Harbour = {
  theme: BedTheme;
  level: number;
  gain: GainNode;
  surf: AudioBufferSourceNode;
  gull: AudioBufferSourceNode | null;
  nextCall: Timer | null;
  fadeOut: Timer | null;
};

const HARBOUR_LEVEL = 0.22;
const HARBOUR_RATE = 12_000;

function makeBed(context: AudioContext, theme: BedTheme): AudioBuffer {
  const buffer = context.createBuffer(1, 12 * HARBOUR_RATE, HARBOUR_RATE);
  const samples = buffer.getChannelData(0);
  const coastal = theme === 'coast';
  let seed = coastal ? 0x3a7291c : 0x540239b, foam = 0, swell = 0;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 0x80000000 - 1;
    foam += 0.29 * (noise - foam);
    swell += 0.055 * (noise - swell);
    const phase = 2 * Math.PI * i / samples.length;
    const tide = 0.34 + 0.16 * Math.cos(3 * phase + 0.5) + 0.11 * Math.cos(2 * phase + 1.1);
    samples[i] = coastal ? (0.44 * swell + 0.20 * foam) * tide :
      (0.46 * swell + 0.09 * foam) * (0.32 + 0.06 * Math.cos(phase) + 0.02 * Math.cos(5 * phase));
  }
  // Join the two ends over 30 ms without inserting a gap in the wash.
  const seam = Math.round(0.03 * HARBOUR_RATE);
  const end = samples.length - seam;
  for (let i = 0; i < seam; i++) {
    const blend = 0.5 - 0.5 * Math.cos(Math.PI * i / seam);
    samples[end + i] = samples[end + i]! * (1 - blend) + samples[i]! * blend;
  }
  return buffer;
}

function makeGull(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, Math.round(0.92 * HARBOUR_RATE), HARBOUR_RATE);
  const samples = buffer.getChannelData(0);
  for (const [start, length, pitch, level] of [[0.04, 0.38, 0.94, 0.17], [0.50, 0.31, 1, 0.12]] as const) {
    let phase = 0;
    for (let i = 0; i < Math.floor(length * HARBOUR_RATE); i++) {
      const t = i / HARBOUR_RATE / length;
      const frequency = pitch * (580 + 420 * Math.sin(Math.PI * t) + 90 * (1 - t));
      phase += 2 * Math.PI * frequency / HARBOUR_RATE;
      const envelope = Math.sin(Math.PI * t) ** 1.7 * (0.89 + 0.11 * Math.sin(28 * t));
      samples[Math.round(start * HARBOUR_RATE) + i] = level * envelope *
        (0.66 * Math.sin(phase) + 0.27 * Math.sin(2 * phase) + 0.07 * Math.sin(3 * phase));
    }
  }
  return buffer;
}

/** CC0 workshop contacts and warm enamel/felt bodies. See assets/audio/README.md. */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = isMuted();
  private loading: Promise<void> | null = null;
  private readonly buffers = new Map<Cue, AudioBuffer>();
  private readonly voices = new Set<AudioScheduledSourceNode>();
  private harbourRequested = false;
  private boardTheme: BedTheme | null = null;
  private boardFast = false;
  private harbour: Harbour | null = null;
  private readonly bedBuffers = new Map<BedTheme, AudioBuffer>();
  private gullBuffer: AudioBuffer | null = null;
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
        // Only catch dense peaks; the baked room and quiet impacts need no audible gain riding.
        compressor.threshold.value = -8;
        compressor.knee.value = 12;
        compressor.ratio.value = 2;
        compressor.attack.value = 0.012;
        compressor.release.value = 0.18;
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.8;
        this.master.connect(compressor).connect(this.ctx.destination);
        this.ctx.onstatechange = () => this.syncHarbour();
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
          this.syncHarbour();
          if (!document.hidden && this.requestedBed && !this.muted && this.ctx?.state === 'suspended') {
            void this.ctx.resume().then(() => this.syncHarbour(), () => {});
          }
        });
      } catch { return; }
    }
    if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
      void this.ctx.resume().then(() => this.syncHarbour(), () => {});
    }
    this.syncHarbour();
    const context = this.ctx;
    this.loading ??= Promise.all((Object.keys(SOUNDS) as Cue[]).map(async cue => {
      try {
        const response = await fetch(SOUNDS[cue]);
        if (!response.ok) return;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(cue, buffer);
      } catch { /* Silence on failure; never block input or retry per tick. */ }
    })).then(() => {});
  }

  get isUnlocked(): boolean { return this.ctx?.state === 'running'; }
  get isMuted(): boolean { return this.muted; }

  toggleMute(): boolean {
    this.muted = !this.muted;
    setMuted(this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
    if (this.muted) {
      this.cancel();
      this.stopHarbour();
    } else this.unlock();
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
    const buffer = this.buffers.get(cue);
    // Loading/offline feedback is silent. A completed download never replays a stale action.
    if (!buffer) return;
    const envelope = this.ctx.createGain();
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    envelope.gain.value = gain;
    this.track(source, envelope);
    source.start(this.ctx.currentTime);
  }

  /** Undo, restart, navigation and hidden/blurred pages discard all sound tails. */
  cancel(): void {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
    this.lastImpact = -Infinity;
  }

  /** Set Little Harbour's desired ambience on entry/exit. Playback needs the existing gesture unlock. */
  harbourAmbience(active: boolean): void {
    this.harbourRequested = active;
    this.syncHarbour();
  }

  /** Chapter is zero-based. Board ambience takes precedence during map/board handoff. */
  boardAmbience(active: boolean, chapter = 0): void {
    this.boardTheme = active ? (chapter === 0 ? 'coast' : 'inland') : null;
    if (!active) this.boardFast = false;
    this.syncHarbour();
  }

  /** Pass the effective fast-forward state, including its automatic resets. */
  boardFastForward(active: boolean): void {
    this.boardFast = active;
    this.syncHarbour();
  }

  private get requestedBed(): BedTheme | null {
    return this.boardTheme ?? (this.harbourRequested ? 'coast' : null);
  }

  private get gullsWanted(): boolean {
    return this.requestedBed === 'coast' && !(this.boardTheme && this.boardFast);
  }

  private syncHarbour(): void {
    const context = this.ctx;
    if (!context || !this.master || this.muted || context.state !== 'running' ||
      (typeof document !== 'undefined' && document.hidden)) {
      this.stopHarbour();
      return;
    }
    const current = this.harbour;
    const theme = this.requestedBed;
    if (!theme || (current && current.theme !== theme)) {
      if (!current || current.fadeOut !== null) return;
      if (current.nextCall !== null) clearTimeout(current.nextCall);
      current.nextCall = null;
      current.gain.gain.setTargetAtTime(0, context.currentTime, 0.09);
      current.fadeOut = setTimeout(() => {
        this.stopHarbour();
        this.syncHarbour();
      }, 540);
      return;
    }
    const level = this.boardTheme ? (theme === 'coast' ? 0.15 : 0.13) * (this.boardFast ? 0.35 : 1) : HARBOUR_LEVEL;
    if (current) {
      if (current.fadeOut !== null || current.level !== level) {
        if (current.fadeOut !== null) clearTimeout(current.fadeOut);
        current.fadeOut = null;
        current.level = level;
        current.gain.gain.setTargetAtTime(level, context.currentTime, 0.16);
      }
      if (!this.gullsWanted && current.nextCall !== null) {
        clearTimeout(current.nextCall);
        current.nextCall = null;
      } else if (this.gullsWanted && !current.gull && current.nextCall === null) {
        this.scheduleGull(current, context, 6500);
      }
      return;
    }

    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);
    const surf = context.createBufferSource();
    const buffer = this.bedBuffers.get(theme) ?? makeBed(context, theme);
    this.bedBuffers.set(theme, buffer);
    surf.buffer = buffer;
    surf.loopStart = 0.03;
    surf.loop = true;
    surf.connect(gain);
    surf.start(context.currentTime, surf.loopStart);
    gain.gain.setTargetAtTime(level, context.currentTime, 0.16);
    const harbour = this.harbour = { theme, level, gain, surf, gull: null, nextCall: null, fadeOut: null };
    if (this.gullsWanted) this.scheduleGull(harbour, context, 6500 + Math.random() * 3500);
  }

  private scheduleGull(harbour: Harbour, context: AudioContext, delay: number): void {
    harbour.nextCall = setTimeout(() => {
      harbour.nextCall = null;
      if (this.harbour !== harbour || !this.gullsWanted || context.state !== 'running' ||
        (typeof document !== 'undefined' && document.hidden)) return;
      const gull = context.createBufferSource();
      harbour.gull = gull;
      gull.buffer = this.gullBuffer ??= makeGull(context);
      gull.playbackRate.value = 0.90 + Math.random() * 0.17;
      gull.connect(harbour.gain);
      gull.onended = () => {
        gull.disconnect();
        harbour.gull = null;
        if (this.harbour === harbour && this.gullsWanted && harbour.fadeOut === null) {
          this.scheduleGull(harbour, context, 15000 + Math.random() * 14000);
        }
      };
      gull.start(context.currentTime);
    }, delay);
  }

  private stopHarbour(): void {
    const harbour = this.harbour;
    if (!harbour) return;
    this.harbour = null;
    if (harbour.fadeOut !== null) clearTimeout(harbour.fadeOut);
    if (harbour.nextCall !== null) clearTimeout(harbour.nextCall);
    if (harbour.gull) {
      harbour.gull.onended = null;
      harbour.gull.stop();
      harbour.gull.disconnect();
    }
    harbour.surf.stop();
    harbour.surf.disconnect();
    harbour.gain.disconnect();
  }

  tap(): void { this.play('tap', 0.32 * (0.94 + Math.random() * 0.12), 0.98 + Math.random() * 0.04); }
  release(): void { this.play('release', 0.38 * (0.94 + Math.random() * 0.12), 0.98 + Math.random() * 0.04); }

  impact(strength: number): void {
    if (!this.ctx || this.muted || this.ctx.currentTime - this.lastImpact < 0.065 || this.voices.size >= 4) return;
    this.lastImpact = this.ctx.currentTime;
    const weight = Math.max(0, Math.min(1, strength));
    this.play(this.impactCount++ % 4 === 3 ? 'glass' : 'wood',
      (0.04 + weight * 0.10) * (0.9 + Math.random() * 0.2), 0.96 + Math.random() * 0.08);
  }

  deliver(slot: number): void { this.play('light', 0.24, 2 ** (Math.min(slot, 4) / 12)); }

  landing(arrival: number): void {
    if (arrival < 3) this.play('light', arrival === 1 ? 0.25 : 0.29, arrival === 1 ? 1 : 2 ** (2 / 12));
    else {
      this.play('final', 0.8, 1, true);
      this.play('complete', 0.4, 1, true);
    }
  }

  boxFilled(chain: number): void { this.play('truck', 0.7, 2 ** (Math.min(chain, 7) / 12), true); }
  /** Call once at the visible ship-bell strike; loading never queues a late strike. */
  harbourBell(): void { this.play('harbourBell', 0.52, 1, true); }
  blocked(): void { this.play('blocked', 0.4, 0.9); }
  undo(): void { this.play('undo', 0.42); }
  jam(): void { this.cancel(); this.play('jam', 0.65, 0.9, true); }
  win(): void { this.cancel(); this.play('win', 0.95, 1, true); }
}

export const sfx = new Sfx();

/**
 * Every game replays exactly from its accepted actions and the tick each one landed on. A saved log
 * is the bug report: the board, the order and the timing, with a fingerprint that proves the replay
 * reached the state the player saw.
 */
export type ReplayAction =
  | { readonly step: number; readonly type: 'tap'; readonly at: number }
  | { readonly step: number; readonly type: 'move'; readonly from: number; readonly to: number }
  | { readonly step: number; readonly type: 'undo' };

export interface ReplayLog {
  readonly version: 1;
  readonly level: string;
  readonly steps: number;
  readonly fingerprint: string;
  readonly actions: readonly ReplayAction[];
}

/** Rule state that can be recorded and driven without any view. */
export interface Replayable {
  /** Fixed ticks run so far. Unlike a machine's own tick, undo does not wind this back. */
  readonly steps: number;
  readonly actions: readonly ReplayAction[];
  step(): unknown;
  /** Returns false when the action was refused, which in a replay means the run has diverged. */
  perform(action: ReplayAction): boolean;
  fingerprint(): string;
}

export function replayLog(level: string, game: Replayable): ReplayLog {
  return { version: 1, level, steps: game.steps, fingerprint: game.fingerprint(), actions: [...game.actions] };
}

export function replayOnto(game: Replayable, log: Pick<ReplayLog, 'steps' | 'actions'>): void {
  let next = 0;
  for (let step = 0; step <= log.steps; step++) {
    for (let action = log.actions[next]; action && action.step === step; action = log.actions[++next]) {
      if (!game.perform(action)) throw new Error(`Replay diverged at step ${step}: ${JSON.stringify(action)} was refused`);
    }
    if (step < log.steps) game.step();
  }
  if (next !== log.actions.length) throw new Error(`Replay stopped with ${log.actions.length - next} actions unplayed`);
}

/** FNV-1a: not secure, just a short name for an exact state. */
export function fingerprintOf(...parts: readonly (string | Uint8Array)[]): string {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    const bytes = typeof part === 'string' ? new TextEncoder().encode(part) : part;
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

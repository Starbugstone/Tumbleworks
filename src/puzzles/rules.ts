import { fingerprintOf, type Replayable, type ReplayAction } from '../engine/replay';
import type { Color } from '../sim/types';
import type {
  PuzzleStatus,
  TubeDef,
  TubeMove,
  TubeMoveResult,
  TubeState,
} from './types';

const COLORS: readonly Color[] = ['red', 'blue', 'green', 'yellow', 'orange'];
/** Seven tubes of five need a few hundred thousand states for a verified hint; it still takes well under a second. */
const DEFAULT_SEARCH_LIMIT = 300_000;
const isColor = (value: unknown): value is Color => typeof value === 'string' && (COLORS as readonly string[]).includes(value);
const isColorArray = (value: unknown): value is Color[] => Array.isArray(value) && value.every(isColor);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isIndex = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const cloneTubes = (tubes: readonly (readonly Color[])[]): Color[][] => tubes.map((tube) => [...tube]);
const colorCounts = (colors: readonly Color[]): Record<Color, number> => {
  const counts: Record<Color, number> = { red: 0, blue: 0, green: 0, yellow: 0, orange: 0 };
  for (const color of colors) counts[color] += 1;
  return counts;
};

export function validateTubeDef(board: TubeDef): void {
  if (board.kind !== 'tube' || !board.id || !board.title || !isIndex(board.capacity) || board.capacity === 0) {
    throw new Error('Invalid tube level identity or capacity');
  }
  if (!Array.isArray(board.tubes) || !board.tubes.every(isColorArray) || board.tubes.length === 0) {
    throw new Error('Invalid tube contents');
  }
  if (board.tubes.some((tube) => tube.length > board.capacity)) throw new Error('A tube exceeds its capacity');
  const counts = colorCounts(board.tubes.flat());
  if (COLORS.some((color) => counts[color] !== 0 && counts[color] !== board.capacity)) {
    throw new Error('Each tube color needs exactly one full tube of marbles');
  }
  if (!Array.isArray(board.solution) || board.solution.some((move) =>
    !move || !isIndex(move.from) || !isIndex(move.to) || move.from >= board.tubes.length || move.to >= board.tubes.length,
  )) throw new Error('Invalid tube solution actions');
}

function tubeIsComplete(tube: readonly Color[], capacity: number): boolean {
  return tube.length === capacity && tube.every((color) => color === tube[0]);
}

export function availableTubeMoves(board: TubeDef, state: Pick<TubeState, 'tubes'>): TubeMove[] {
  const result: TubeMove[] = [];
  state.tubes.forEach((source, from) => {
    const color = source.at(-1);
    if (!color) return;
    state.tubes.forEach((destination, to) => {
      if (from !== to && destination.length < board.capacity && (destination.length === 0 || destination.at(-1) === color)) {
        result.push({ from, to });
      }
    });
  });
  return result;
}

function tubeStatus(board: TubeDef, tubes: Color[][]): PuzzleStatus {
  if (tubes.every((tube) => tube.length === 0 || tubeIsComplete(tube, board.capacity))) return 'won';
  return availableTubeMoves(board, { tubes }).length ? 'playing' : 'jammed';
}

function tubeMove(board: TubeDef, state: TubeState, from: number, to: number): TubeMoveResult {
  if (state.status !== 'playing') return { ok: false, reason: 'finished' };
  if (!isIndex(from) || !isIndex(to) || from >= state.tubes.length || to >= state.tubes.length) {
    return { ok: false, reason: 'invalid-tube' };
  }
  if (from === to) return { ok: false, reason: 'same-tube' };
  const source = state.tubes[from];
  const destination = state.tubes[to];
  if (!source || !destination) return { ok: false, reason: 'invalid-tube' };
  const color = source.at(-1);
  if (!color) return { ok: false, reason: 'empty' };
  if (destination.length === board.capacity) return { ok: false, reason: 'full' };
  if (destination.length && destination.at(-1) !== color) return { ok: false, reason: 'different-color' };
  let runLength = 1;
  while (runLength < source.length && source[source.length - runLength - 1] === color) runLength += 1;
  const count = Math.min(runLength, board.capacity - destination.length);
  const fromSlot = source.length - count;
  const toSlot = destination.length;
  destination.push(...source.splice(fromSlot, count));
  state.moves += 1;
  state.status = tubeStatus(board, state.tubes);
  return { ok: true, color, from, to, fromSlot, toSlot, count, completedTube: tubeIsComplete(destination, board.capacity) };
}

interface TubeSearchNode {
  readonly tubes: Color[][];
  readonly parent: number;
  readonly action: TubeMove | null;
}

/** Tube positions are interchangeable in this ruleset, so symmetric states need only one visit. */
const tubeKey = (tubes: readonly (readonly Color[])[]): string => tubes.map((tube) => tube.join(',')).sort().join('|');

export function solveTube(board: TubeDef, state: TubeState, limit = DEFAULT_SEARCH_LIMIT): TubeMove[] | null {
  if (state.status === 'won') return [];
  if (state.status === 'jammed' || !isIndex(limit) || limit === 0) return null;
  const nodes: TubeSearchNode[] = [{ tubes: cloneTubes(state.tubes), parent: -1, action: null }];
  const visited = new Set([tubeKey(state.tubes)]);
  const path = (index: number): TubeMove[] => {
    const actions: TubeMove[] = [];
    while (index >= 0) {
      const node = nodes[index];
      if (!node) break;
      if (node.action) actions.push(node.action);
      index = node.parent;
    }
    return actions.reverse();
  };
  for (let cursor = 0; cursor < nodes.length; cursor += 1) {
    const node = nodes[cursor];
    if (!node) break;
    const actions = availableTubeMoves(board, node);
    actions.sort((a, b) => Number(Boolean(node.tubes[b.to]?.length)) - Number(Boolean(node.tubes[a.to]?.length)));
    const triedEmpty = new Set<number>();
    for (const action of actions) {
      if (node.tubes[action.to]?.length === 0) {
        if (triedEmpty.has(action.from)) continue;
        triedEmpty.add(action.from);
      }
      const next: TubeState = { tubes: cloneTubes(node.tubes), moves: 0, status: 'playing' };
      if (!tubeMove(board, next, action.from, action.to).ok) continue;
      const key = tubeKey(next.tubes);
      if (visited.has(key)) continue;
      visited.add(key);
      nodes.push({ tubes: next.tubes, parent: cursor, action });
      if (next.status === 'won') return path(nodes.length - 1);
      if (visited.size >= limit) return null;
    }
  }
  return null;
}

export class TubeRules implements Replayable {
  state: TubeState;
  private readonly history: TubeState[] = [];
  readonly actions: ReplayAction[] = [];
  /** Tube Sort has no clock: its rules change only on a move, whatever the marbles are doing on screen. */
  readonly steps = 0;

  constructor(readonly board: TubeDef) {
    validateTubeDef(board);
    const tubes = cloneTubes(board.tubes);
    this.state = { tubes, moves: 0, status: tubeStatus(board, tubes) };
  }

  get status(): PuzzleStatus { return this.state.status; }
  get canUndo(): boolean { return this.history.length > 0; }

  move(from: number, to: number): TubeMoveResult {
    const before = this.snapshot();
    const result = tubeMove(this.board, this.state, from, to);
    if (result.ok) {
      this.history.push(before);
      this.actions.push({ step: 0, type: 'move', from, to });
    }
    return result;
  }

  undo(): boolean {
    const before = this.history.pop();
    if (!before) return false;
    this.state = before;
    this.actions.push({ step: 0, type: 'undo' });
    return true;
  }

  step(): void {}

  perform(action: ReplayAction): boolean {
    if (action.type === 'undo') return this.undo();
    return action.type === 'move' && this.move(action.from, action.to).ok;
  }

  fingerprint(): string { return fingerprintOf(JSON.stringify(this.state)); }

  hint(): TubeMove | null { return solveTube(this.board, this.state)?.[0] ?? null; }
  snapshot(): TubeState { return structuredClone(this.state); }

  restore(value: unknown): void {
    if (!isRecord(value) || !Array.isArray(value.tubes) || !value.tubes.every(isColorArray) || !isIndex(value.moves)) {
      throw new Error('Invalid saved tube state');
    }
    const tubes = value.tubes;
    if (tubes.length !== this.board.tubes.length || tubes.some((tube) => tube.length > this.board.capacity)) {
      throw new Error('Saved tube dimensions do not match this level');
    }
    const original = colorCounts(this.board.tubes.flat());
    const restored = colorCounts(tubes.flat());
    if (COLORS.some((color) => original[color] !== restored[color])) throw new Error('Saved tube state loses marbles');
    const status = tubeStatus(this.board, tubes);
    if (value.status !== status) throw new Error('Saved tube status does not match the board');
    this.state = { tubes: cloneTubes(tubes), moves: value.moves, status };
    this.history.length = 0;
  }
}

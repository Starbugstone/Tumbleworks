import { fingerprintOf, type Replayable, type ReplayAction } from '../engine/replay';
import { COLORS, type Color } from '../sim/types';
import type {
  PuzzleStatus,
  TubeDef,
  TubeContainer,
  TubeMove,
  TubeMoveResult,
  TubeState,
} from './types';

/** Seven tubes of five need a few hundred thousand states for a verified hint; it still takes well under a second. */
const DEFAULT_SEARCH_LIMIT = 300_000;
const isColor = (value: unknown): value is Color => typeof value === 'string' && (COLORS as readonly string[]).includes(value);
const isColorArray = (value: unknown): value is Color[] => Array.isArray(value) && value.every(isColor);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isIndex = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const cloneTubes = (tubes: readonly (readonly Color[])[]): Color[][] => tubes.map((tube) => [...tube]);
const colorCounts = (colors: readonly Color[]): Record<Color, number> => {
  const counts = Object.fromEntries(COLORS.map((color) => [color, 0])) as Record<Color, number>;
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
  if (board.containers !== undefined && (!Array.isArray(board.containers) || board.containers.length !== board.tubes.length)) {
    throw new Error('Each tube needs a container definition');
  }
  const counts = colorCounts(board.tubes.flat());
  if (board.colorCapacities !== undefined && (!isRecord(board.colorCapacities) ||
    Object.entries(board.colorCapacities).some(([color, count]) => !isColor(color) || !isIndex(count) || count === 0 || !counts[color]))) {
    throw new Error('Invalid per-colour home capacity');
  }
  const homes = new Map<number, number>();
  board.tubes.forEach((tube, index) => {
    if (board.containers && !isRecord(board.containers[index])) throw new Error('Invalid tube container');
    const container = tubeContainer(board, index);
    if (!container || !isIndex(container.capacity) || container.capacity === 0 || tube.length > container.capacity) throw new Error('Invalid container capacity');
    switch (container.role) {
      case 'ordinary': case 'capped':
        if (!board.colorCapacities && container.capacity !== board.capacity) throw new Error('Ordinary homes use the full colour capacity');
        homes.set(container.capacity, (homes.get(container.capacity) ?? 0) + 1);
        if (container.role === 'capped' && (tube.length || !isColor(container.opensOn) || !counts[container.opensOn])) throw new Error('A capped spare must be empty and reference a present colour');
        break;
      case 'cup':
        if (container.capacity !== 2 || tube.length) throw new Error('A closing cup starts empty and holds two');
        break;
      default: throw new Error('Unknown tube role');
    }
  });
  const ordinaryColors = COLORS.filter((color) => counts[color]);
  const needed = new Map<number, number>();
  for (const color of ordinaryColors) {
    const capacity = tubeColorCapacity(board, color);
    if (counts[color] !== capacity) throw new Error('Each tube color needs exactly one full home of marbles');
    needed.set(capacity, (needed.get(capacity) ?? 0) + 1);
  }
  if ([...needed].some(([capacity, count]) => (homes.get(capacity) ?? 0) < count)) {
    throw new Error('Each colour needs a distinct home of its required capacity');
  }
  for (const container of board.containers ?? []) {
    if (container.role === 'capped' && !board.tubes.some((_, i) => { const home = tubeContainer(board, i); return home.role === 'ordinary' && home.capacity === tubeColorCapacity(board, container.opensOn); })) {
      throw new Error('A cap prerequisite needs an accessible completion home');
    }
  }
  if (!Array.isArray(board.solution) || board.solution.some((move) =>
    !move || !isIndex(move.from) || !isIndex(move.to) || move.from >= board.tubes.length || move.to >= board.tubes.length,
  )) throw new Error('Invalid tube solution actions');
}

function tubeIsComplete(tube: readonly Color[], capacity: number): boolean {
  return tube.length === capacity && tube.every((color) => color === tube[0]);
}

export function tubeContainer(board: TubeDef, index: number): TubeContainer {
  return board.containers?.[index] ?? { role: 'ordinary', capacity: board.capacity };
}

export function cloneTubeState(state: TubeState): TubeState {
  return { tubes: cloneTubes(state.tubes), opened: [...state.opened], spent: [...state.spent], moves: state.moves, status: state.status };
}

/** Legality has one owner for touch, drag, hints and authoring. It never mutates state. */
export function tubeMoveRejection(board: TubeDef, state: TubeState, from: number, to: number): Extract<TubeMoveResult, { ok: false }>['reason'] | null {
  if (state.status !== 'playing') return 'finished';
  if (!isIndex(from) || !isIndex(to) || from >= state.tubes.length || to >= state.tubes.length) return 'invalid-tube';
  if (from === to) return 'same-tube';
  const sourceRole = tubeContainer(board, from);
  const targetRole = tubeContainer(board, to);
  if ((sourceRole.role === 'capped' && !state.opened[from]) || (targetRole.role === 'capped' && !state.opened[to])) return 'capped';
  if (state.spent[from] || state.spent[to]) return 'spent';
  const source = state.tubes[from]!;
  const destination = state.tubes[to]!;
  const color = source.at(-1);
  if (!color) return 'empty';
  if (destination.length === targetRole.capacity) return 'full';
  if (destination.length && destination.at(-1) !== color) return 'different-color';
  return null;
}

export function availableTubeMoves(board: TubeDef, state: TubeState): TubeMove[] {
  const result: TubeMove[] = [];
  state.tubes.forEach((source, from) => {
    const color = source.at(-1);
    if (!color || state.status !== 'playing') return;
    state.tubes.forEach((destination, to) => {
      if (from === to || destination.length >= tubeContainer(board, to).capacity || (destination.length && destination.at(-1) !== color)) return;
      if (!board.containers || tubeMoveRejection(board, state, from, to) === null) result.push({ from, to });
    });
  });
  return result;
}

export function tubeColorCapacity(board: TubeDef, color: Color): number {
  return board.colorCapacities?.[color] ?? board.capacity;
}

export function completedTube(board: TubeDef, state: TubeState, index: number): boolean {
  const container = tubeContainer(board, index);
  const tube = state.tubes[index]!;
  return container.role !== 'cup' && tube[0] !== undefined && container.capacity === tubeColorCapacity(board, tube[0])
    && tubeIsComplete(tube, container.capacity);
}

function tubeStatus(board: TubeDef, state: TubeState): PuzzleStatus {
  if (state.tubes.every((tube, index) => {
    const container = tubeContainer(board, index);
    return container.role === 'cup' ? !tube.length : !tube.length || completedTube(board, state, index);
  })) return 'won';
  return availableTubeMoves(board, { ...state, status: 'playing' }).length ? 'playing' : 'jammed';
}

/** Apply the entire commitment before status: an opening can rescue an otherwise blocked position. */
export function moveTubeState(board: TubeDef, state: TubeState, from: number, to: number): TubeMoveResult {
  const reason = tubeMoveRejection(board, state, from, to);
  if (reason) return { ok: false, reason };
  const source = state.tubes[from]!;
  const destination = state.tubes[to]!;
  const color = source.at(-1)!;
  let runLength = 1;
  while (runLength < source.length && source[source.length - runLength - 1] === color) runLength += 1;
  const count = Math.min(runLength, tubeContainer(board, to).capacity - destination.length);
  const fromSlot = source.length - count;
  const toSlot = destination.length;
  destination.push(...source.splice(fromSlot, count));
  if (tubeContainer(board, from).role === 'cup' && !source.length) state.spent[from] = true;
  const completed = completedTube(board, state, to);
  if (completed) board.tubes.forEach((_, index) => {
    const container = tubeContainer(board, index);
    if (container.role === 'capped' && container.opensOn === color) state.opened[index] = true;
  });
  state.moves += 1;
  state.status = tubeStatus(board, state);
  return { ok: true, color, from, to, fromSlot, toSlot, count, completedTube: completed };
}

interface TubeSearchNode {
  readonly state: TubeState;
  readonly parent: number;
  readonly action: TubeMove | null;
}

/** Only ordinary homes of the same capacity are interchangeable. Special containers keep their identity. */
export function tubeKey(board: TubeDef, state: TubeState): string {
  if (!board.containers) return state.tubes.map((tube) => tube.join(',')).sort().join('|');
  const ordinary: string[] = [];
  const fixed: string[] = [];
  state.tubes.forEach((tube, index) => {
    const container = tubeContainer(board, index);
    const contents = tube.join(',');
    if (container.role === 'ordinary') ordinary.push(`${container.capacity}:${contents}`);
    else fixed.push(`${index}:${JSON.stringify(container)}:${Number(state.opened[index])}:${Number(state.spent[index])}:${contents}`);
  });
  return `${ordinary.sort().join('|')}#${fixed.join('|')}`;
}

export function solveTube(board: TubeDef, state: TubeState, limit = DEFAULT_SEARCH_LIMIT): TubeMove[] | null {
  return solveTubeSearch(board, state, limit).moves;
}

/** The shortest solution and the states visited: authoring caps the count, because a clock would change with machine load. */
export function solveTubeSearch(board: TubeDef, state: TubeState, limit = DEFAULT_SEARCH_LIMIT): { readonly moves: TubeMove[] | null; readonly states: number; readonly exhaustive: boolean } {
  if (state.status === 'won') return { moves: [], states: 0, exhaustive: true };
  if (state.status === 'jammed') return { moves: null, states: 0, exhaustive: true };
  if (!isIndex(limit) || limit === 0) return { moves: null, states: 0, exhaustive: false };
  const nodes: TubeSearchNode[] = [{ state: cloneTubeState(state), parent: -1, action: null }];
  const visited = new Set([tubeKey(board, state)]);
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
    const actions = availableTubeMoves(board, node.state);
    actions.sort((a, b) => Number(Boolean(node.state.tubes[b.to]?.length)) - Number(Boolean(node.state.tubes[a.to]?.length)));
    const triedEmpty = new Set<string>();
    for (const action of actions) {
      if (node.state.tubes[action.to]?.length === 0 && tubeContainer(board, action.to).role === 'ordinary') {
        if (triedEmpty.has(`${action.from}:${tubeContainer(board, action.to).capacity}`)) continue;
        triedEmpty.add(`${action.from}:${tubeContainer(board, action.to).capacity}`);
      }
      const next = cloneTubeState(node.state);
      if (!moveTubeState(board, next, action.from, action.to).ok) continue;
      const key = tubeKey(board, next);
      if (visited.has(key)) continue;
      visited.add(key);
      nodes.push({ state: next, parent: cursor, action });
      if (next.status === 'won') return { moves: path(nodes.length - 1), states: visited.size, exhaustive: true };
      if (visited.size >= limit) return { moves: null, states: visited.size, exhaustive: false };
    }
  }
  return { moves: null, states: visited.size, exhaustive: true };
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
    this.state = { tubes, opened: tubes.map(() => false), spent: tubes.map(() => false), moves: 0, status: 'playing' };
    // Existing completions count as the first completion, in the initial board.
    tubes.forEach((_, index) => {
      const container = tubeContainer(board, index);
      if (container.role === 'capped') this.state.opened[index] = tubes.some((tube, other) => tube[0] === container.opensOn && completedTube(board, this.state, other));
    });
    this.state.status = tubeStatus(board, this.state);
  }

  get status(): PuzzleStatus { return this.state.status; }
  get canUndo(): boolean { return this.history.length > 0; }

  move(from: number, to: number): TubeMoveResult {
    const before = this.snapshot();
    const result = moveTubeState(this.board, this.state, from, to);
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
  snapshot(): TubeState { return cloneTubeState(this.state); }

  restore(value: unknown): void {
    if (!isRecord(value) || !Array.isArray(value.tubes) || !value.tubes.every(isColorArray) || !isIndex(value.moves)) {
      throw new Error('Invalid saved tube state');
    }
    const tubes = value.tubes;
    if (tubes.length !== this.board.tubes.length || tubes.some((tube, index) => tube.length > tubeContainer(this.board, index).capacity)) {
      throw new Error('Saved tube dimensions do not match this level');
    }
    const original = colorCounts(this.board.tubes.flat());
    const restored = colorCounts(tubes.flat());
    if (COLORS.some((color) => original[color] !== restored[color])) throw new Error('Saved tube state loses marbles');
    const flags = (value: unknown): value is boolean[] => Array.isArray(value) && value.length === tubes.length && value.every((flag) => typeof flag === 'boolean');
    if (!flags(value.opened) || !flags(value.spent)) throw new Error('Missing tube commitment state');
    const restoredState: TubeState = { tubes: cloneTubes(tubes), opened: [...value.opened], spent: [...value.spent], moves: value.moves, status: 'playing' };
    tubes.forEach((tube, index) => {
      const container = tubeContainer(this.board, index);
      if ((container.role !== 'capped' && restoredState.opened[index]) || (container.role !== 'cup' && restoredState.spent[index]) ||
        (container.role === 'capped' && !restoredState.opened[index] && tube.length) || (restoredState.spent[index] && tube.length)) throw new Error('Invalid tube commitment state');
      if (container.role === 'capped' && tubes.some((other, i) => other[0] === container.opensOn && completedTube(this.board, restoredState, i)) && !restoredState.opened[index]) throw new Error('Missing completion latch');
    });
    const status = tubeStatus(this.board, restoredState);
    if (value.status !== status) throw new Error('Saved tube status does not match the board');
    this.state = { ...restoredState, status };
    this.history.length = 0;
  }
}

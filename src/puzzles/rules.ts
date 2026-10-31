import type { Color } from '../sim/types';
import type {
  PuzzleStatus,
  TrayDef,
  TrayPickResult,
  TrayState,
  TubeDef,
  TubeMove,
  TubeMoveResult,
  TubeState,
} from './types';

const COLORS: readonly Color[] = ['red', 'blue', 'green', 'yellow'];
const DEFAULT_SEARCH_LIMIT = 30_000;
const isColor = (value: unknown): value is Color =>
  value === 'red' || value === 'blue' || value === 'green' || value === 'yellow';
const isColorArray = (value: unknown): value is Color[] => Array.isArray(value) && value.every(isColor);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isIndex = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isIdArray = (value: unknown): value is number[] => Array.isArray(value) && value.every(isIndex);
const cloneTubes = (tubes: readonly (readonly Color[])[]): Color[][] => tubes.map((tube) => [...tube]);
const colorCounts = (colors: readonly Color[]): Record<Color, number> => {
  const counts: Record<Color, number> = { red: 0, blue: 0, green: 0, yellow: 0 };
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

export class TubeRules {
  state: TubeState;
  private readonly history: TubeState[] = [];

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
    if (result.ok) this.history.push(before);
    return result;
  }

  undo(): boolean {
    const before = this.history.pop();
    if (!before) return false;
    this.state = before;
    return true;
  }

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

export function validateTrayDef(board: TrayDef): void {
  if (board.kind !== 'tray' || !board.id || !board.title || !isIndex(board.rackCapacity) || board.rackCapacity < 3) {
    throw new Error('Invalid tray level identity or capacity');
  }
  if (!Array.isArray(board.pieces) || !Array.isArray(board.solution)) throw new Error('Invalid tray pieces or solution');
  const ids = new Set<number>();
  for (const piece of board.pieces) {
    if (!piece || !isIndex(piece.id) || ids.has(piece.id) || !isColor(piece.color) || !isIndex(piece.layer) ||
      !Number.isFinite(piece.x) || !Number.isFinite(piece.z) || !isIdArray(piece.blockedBy) ||
      new Set(piece.blockedBy).size !== piece.blockedBy.length) throw new Error('Invalid or duplicate tray piece');
    ids.add(piece.id);
  }
  for (const piece of board.pieces) {
    if (piece.blockedBy.some((id: number) => !ids.has(id) || id === piece.id)) throw new Error('A tray blocker is missing or self-referential');
  }
  const counts = colorCounts(board.pieces.map((piece) => piece.color));
  if (COLORS.some((color) => counts[color] % 3 !== 0)) throw new Error('Every tray color must form complete triples');
  const visited = new Set<number>();
  const visiting = new Set<number>();
  const pieces = new Map(board.pieces.map((piece) => [piece.id, piece]));
  const visit = (id: number): void => {
    if (visiting.has(id)) throw new Error('Tray cover graph contains a cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const blocker of pieces.get(id)?.blockedBy ?? []) visit(blocker);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
  if (!isIdArray(board.solution) || board.solution.some((id) => !ids.has(id))) throw new Error('Invalid tray solution actions');
}

export function availableTrayPieces(board: TrayDef, state: Pick<TrayState, 'remaining'>): number[] {
  const remaining = new Set(state.remaining);
  return board.pieces.filter((piece) => remaining.has(piece.id) && piece.blockedBy.every((id) => !remaining.has(id))).map((piece) => piece.id);
}

function trayStatus(board: TrayDef, state: Pick<TrayState, 'remaining' | 'rack'>): PuzzleStatus {
  if (!state.remaining.length && !state.rack.length) return 'won';
  return state.rack.length >= board.rackCapacity ? 'jammed' : 'playing';
}

function trayPick(board: TrayDef, state: TrayState, id: number): TrayPickResult {
  if (state.status !== 'playing') return { ok: false, reason: 'finished' };
  if (!isIndex(id)) return { ok: false, reason: 'invalid-piece' };
  const piece = board.pieces.find((candidate) => candidate.id === id);
  if (!piece) return { ok: false, reason: 'invalid-piece' };
  if (!state.remaining.includes(id)) return { ok: false, reason: 'removed' };
  if (piece.blockedBy.some((blocker) => state.remaining.includes(blocker))) return { ok: false, reason: 'covered' };
  state.remaining.splice(state.remaining.indexOf(id), 1);
  state.rack.push(id);
  state.moves += 1;
  const colors = new Map(board.pieces.map((candidate) => [candidate.id, candidate.color]));
  const matching = state.rack.filter((rackId) => colors.get(rackId) === piece.color);
  const clearedIds = matching.length === 3 ? matching : [];
  if (clearedIds.length) state.rack = state.rack.filter((rackId) => !clearedIds.includes(rackId));
  state.status = trayStatus(board, state);
  return { ok: true, color: piece.color, clearedIds };
}

export function solveTray(board: TrayDef, state: TrayState, limit = DEFAULT_SEARCH_LIMIT): number[] | null {
  if (state.status === 'won') return [];
  if (state.status === 'jammed' || !isIndex(limit) || limit === 0) return null;
  const colors = new Map(board.pieces.map((piece) => [piece.id, piece.color]));
  const visited = new Set<string>();
  let exhausted = false;
  const search = (current: TrayState): number[] | null => {
    if (current.status === 'won') return [];
    if (current.status === 'jammed' || exhausted) return null;
    const key = [...current.remaining].sort((a, b) => a - b).join(',') + '|' + current.rack.map((id) => colors.get(id)).sort().join(',');
    if (visited.has(key)) return null;
    if (visited.size >= limit) { exhausted = true; return null; }
    visited.add(key);
    const counts = colorCounts(current.rack.flatMap((id) => {
      const color = colors.get(id);
      return color ? [color] : [];
    }));
    const actions = availableTrayPieces(board, current);
    actions.sort((a, b) => (counts[colors.get(b) ?? 'red'] - counts[colors.get(a) ?? 'red']) || a - b);
    for (const id of actions) {
      const next = structuredClone(current);
      if (!trayPick(board, next, id).ok) continue;
      const rest = search(next);
      if (rest) return [id, ...rest];
    }
    return null;
  };
  return search(structuredClone(state));
}

export class TrayRules {
  state: TrayState;
  private readonly history: TrayState[] = [];

  constructor(readonly board: TrayDef) {
    validateTrayDef(board);
    const initial = { remaining: board.pieces.map((piece) => piece.id), rack: [], moves: 0 };
    this.state = { ...initial, status: trayStatus(board, initial) };
  }

  get status(): PuzzleStatus { return this.state.status; }
  get canUndo(): boolean { return this.history.length > 0; }
  get available(): number[] { return availableTrayPieces(this.board, this.state); }

  pick(id: number): TrayPickResult {
    const before = this.snapshot();
    const result = trayPick(this.board, this.state, id);
    if (result.ok) this.history.push(before);
    return result;
  }

  undo(): boolean {
    const before = this.history.pop();
    if (!before) return false;
    this.state = before;
    return true;
  }

  hint(): number | null { return solveTray(this.board, this.state)?.[0] ?? null; }
  snapshot(): TrayState { return structuredClone(this.state); }

  restore(value: unknown): void {
    if (!isRecord(value) || !isIdArray(value.remaining) || !isIdArray(value.rack) || !isIndex(value.moves)) {
      throw new Error('Invalid saved tray state');
    }
    const ids = new Set(this.board.pieces.map((piece) => piece.id));
    const occupied = [...value.remaining, ...value.rack];
    if (new Set(occupied).size !== occupied.length || occupied.some((id) => !ids.has(id)) || value.rack.length > this.board.rackCapacity) {
      throw new Error('Saved tray identities do not match the level');
    }
    const remaining = new Set(value.remaining);
    if (this.board.pieces.some((piece) => !remaining.has(piece.id) && piece.blockedBy.some((id) => remaining.has(id)))) {
      throw new Error('Saved tray state removed a covered piece');
    }
    const counts = (pieceIds: number[]): Record<Color, number> => colorCounts(this.board.pieces.filter((piece) => pieceIds.includes(piece.id)).map((piece) => piece.color));
    const total = colorCounts(this.board.pieces.map((piece) => piece.color));
    const remainingCounts = counts(value.remaining);
    const rackCounts = counts(value.rack);
    if (COLORS.some((color) => rackCounts[color] >= 3 || (total[color] - remainingCounts[color] - rackCounts[color]) % 3 !== 0) ||
      value.moves !== this.board.pieces.length - value.remaining.length) throw new Error('Saved tray matches do not conserve marbles');
    const status = trayStatus(this.board, { remaining: value.remaining, rack: value.rack });
    if (value.status !== status) throw new Error('Saved tray status does not match the board');
    this.state = { remaining: [...value.remaining], rack: [...value.rack], moves: value.moves, status };
    this.history.length = 0;
  }
}

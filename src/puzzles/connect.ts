import type { Color } from '../sim/types';
import type { PuzzleStatus } from './types';

export interface ConnectDef {
  readonly id: string;
  readonly title: string;
  readonly columns: readonly (readonly Color[])[];
  readonly maxMoves: number;
  /** Stable IDs assigned column-first, bottom-first. */
  readonly solution: readonly number[];
}
export interface ConnectState { columns: number[][]; moves: number; status: PuzzleStatus }
export interface ConnectPiece { readonly id: number; readonly color: Color; readonly column: number; readonly slot: number }
export const connectPieces = (board: ConnectDef): ConnectPiece[] => {
  let id = 0;
  return board.columns.flatMap((column, index) => column.map((color, slot) => ({ id: id++, color, column: index, slot })));
};
const colors: readonly unknown[] = ['red', 'blue', 'green', 'yellow'];
const clone = (state: ConnectState): ConnectState => structuredClone(state);

export class ConnectRules {
  private current: ConnectState;
  private readonly history: ConnectState[] = [];
  readonly pieces: readonly ConnectPiece[];
  constructor(readonly board: ConnectDef) {
    if (!board.id || !board.columns.length || board.columns.some((column) => !column.length || column.some((color) => !colors.includes(color))) || !Number.isInteger(board.maxMoves) || board.maxMoves < 1) throw new Error('Invalid connected board');
    this.pieces = connectPieces(board);
    this.current = { columns: board.columns.map((_, column) => this.pieces.filter((piece) => piece.column === column).map((piece) => piece.id)), moves: 0, status: 'playing' };
    this.current.status = this.evaluate(this.current);
  }
  get state(): Readonly<ConnectState> { return this.current; }
  get status() { return this.current.status; }
  get canUndo() { return this.history.length > 0; }
  color(id: number): Color | undefined { return this.pieces[id]?.color; }
  group(id: number, state = this.current): number[] {
    const column = state.columns.findIndex((values) => values.includes(id));
    const slot = state.columns[column]?.indexOf(id) ?? -1;
    if (column < 0 || slot < 0) return [];
    const found = new Set<number>();
    const pending: [number, number][] = [[column, slot]];
    while (pending.length) {
      const [x, y] = pending.pop()!;
      const next = state.columns[x]?.[y];
      if (next === undefined || found.has(next) || this.color(next) !== this.color(id)) continue;
      found.add(next);
      pending.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
    }
    return [...found].sort((a, b) => a - b);
  }
  private groups(state: ConnectState): number[][] {
    const visited = new Set<number>();
    const result: number[][] = [];
    for (const id of state.columns.flat()) {
      if (visited.has(id)) continue;
      const group = this.group(id, state);
      group.forEach((piece) => visited.add(piece));
      if (group.length >= 3) result.push(group);
    }
    return result;
  }
  private evaluate(state: ConnectState): PuzzleStatus {
    if (!state.columns.some((column) => column.length)) return 'won';
    return state.moves >= this.board.maxMoves || !this.groups(state).length ? 'jammed' : 'playing';
  }
  private next(state: ConnectState, ids: readonly number[]): ConnectState {
    const removed = new Set(ids);
    const next: ConnectState = { columns: state.columns.map((column) => column.filter((id) => !removed.has(id))), moves: state.moves + 1, status: 'playing' };
    next.status = this.evaluate(next);
    return next;
  }
  pick(id: number): readonly number[] | null {
    if (this.status !== 'playing') return null;
    const group = this.group(id);
    if (group.length < 3) return null;
    this.history.push(this.snapshot());
    this.current = this.next(this.current, group);
    return group;
  }
  snapshot(): ConnectState { return clone(this.current); }
  undo(): boolean { const previous = this.history.pop(); if (!previous) return false; this.current = previous; return true; }
  restore(value: unknown): void {
    if (!value || typeof value !== 'object' || !('columns' in value) || !Array.isArray(value.columns) || value.columns.length !== this.board.columns.length || !('moves' in value) || !Number.isInteger(value.moves) || typeof value.moves !== 'number' || value.moves < 0 || value.moves > this.board.maxMoves) throw new Error('Invalid connected snapshot');
    const seen = new Set<number>();
    const columns: number[][] = value.columns.map((column: unknown, index: number) => {
      if (!Array.isArray(column)) throw new Error('Invalid column');
      let previousSlot = -1;
      return column.map((id: unknown) => {
        if (typeof id !== 'number' || !Number.isInteger(id) || seen.has(id)) throw new Error('Invalid piece');
        const piece = this.pieces[id];
        if (!piece || piece.column !== index || piece.slot <= previousSlot) throw new Error('Invalid piece order');
        seen.add(id); previousSlot = piece.slot; return id;
      });
    });
    const state: ConnectState = { columns, moves: value.moves, status: 'playing' };
    state.status = this.evaluate(state);
    if (!('status' in value) || value.status !== state.status) throw new Error('Invalid status');
    this.current = state;
    this.history.length = 0;
  }
  hint(limit = 20000): number | null {
    const seen = new Set<string>();
    let searched = 0;
    const search = (state: ConnectState): number[] | null => {
      if (state.status === 'won') return [];
      if (state.status !== 'playing' || searched++ >= limit) return null;
      const key = `${state.moves}:${state.columns.map((column) => column.join(',')).join('|')}`;
      if (seen.has(key)) return null;
      seen.add(key);
      for (const group of this.groups(state).sort((a, b) => b.length - a.length)) {
        const solution = search(this.next(state, group));
        if (solution) return [group[0]!, ...solution];
      }
      return null;
    };
    return search(this.current)?.[0] ?? null;
  }
}

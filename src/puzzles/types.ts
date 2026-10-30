import type { Color } from '../sim/types';

export type PuzzleStatus = 'playing' | 'won' | 'jammed';

export interface TubeMove {
  readonly from: number;
  readonly to: number;
}

export interface TubeDef {
  readonly kind: 'tube';
  readonly id: string;
  readonly title: string;
  readonly capacity: number;
  /** Bottom marble first. */
  readonly tubes: readonly (readonly Color[])[];
  readonly solution: readonly TubeMove[];
}

export interface TrayPiece {
  readonly id: number;
  readonly color: Color;
  readonly x: number;
  readonly z: number;
  readonly layer: number;
  readonly blockedBy: readonly number[];
}

export interface TrayDef {
  readonly kind: 'tray';
  readonly id: string;
  readonly title: string;
  readonly rackCapacity: number;
  readonly pieces: readonly TrayPiece[];
  readonly solution: readonly number[];
}

export type PuzzleDef = TubeDef | TrayDef;

export interface TubeState {
  tubes: Color[][];
  moves: number;
  status: PuzzleStatus;
}

export interface TrayState {
  remaining: number[];
  rack: number[];
  moves: number;
  status: PuzzleStatus;
}

export type TubeMoveResult =
  | {
      readonly ok: true;
      readonly color: Color;
      readonly from: number;
      readonly to: number;
      readonly fromSlot: number;
      readonly toSlot: number;
      readonly completedTube: boolean;
    }
  | { readonly ok: false; readonly reason: 'finished' | 'invalid-tube' | 'same-tube' | 'empty' | 'full' | 'different-color' };

export type TrayPickResult =
  | { readonly ok: true; readonly color: Color; readonly clearedIds: readonly number[] }
  | { readonly ok: false; readonly reason: 'finished' | 'invalid-piece' | 'removed' | 'covered' };

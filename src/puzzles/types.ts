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

export interface TubeState {
  tubes: Color[][];
  moves: number;
  status: PuzzleStatus;
}

export type TubeMoveResult =
  | {
      readonly ok: true;
      readonly color: Color;
      readonly from: number;
      readonly to: number;
      /** Lowest source slot transferred, including when only part of the top group fits. */
      readonly fromSlot: number;
      readonly toSlot: number;
      readonly count: number;
      readonly completedTube: boolean;
    }
  | { readonly ok: false; readonly reason: 'finished' | 'invalid-tube' | 'same-tube' | 'empty' | 'full' | 'different-color' };

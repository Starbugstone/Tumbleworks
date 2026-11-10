import type { Color } from '../sim/types';

export type PuzzleStatus = 'playing' | 'won' | 'jammed';

export interface TubeMove {
  readonly from: number;
  readonly to: number;
}

export type TubeContainer =
  | { readonly role: 'ordinary'; readonly capacity: number }
  | { readonly role: 'capped'; readonly capacity: number; readonly opensOn: Color }
  | { readonly role: 'cup'; readonly capacity: 2 };

export interface TubeDef {
  readonly kind: 'tube';
  readonly id: string;
  readonly title: string;
  readonly capacity: number;
  /** Whole-colour counts and final home sizes; omitted colours use capacity. */
  readonly colorCapacities?: Readonly<Partial<Record<Color, number>>>;
  /** Bottom marble first. */
  readonly tubes: readonly (readonly Color[])[];
  readonly solution: readonly TubeMove[];
  /** Omitted on classic boards: every tube is ordinary with the board capacity. */
  readonly containers?: readonly TubeContainer[];
}

export interface TubeState {
  tubes: Color[][];
  /** Monotone until undo; indexed by container. False for roles without a latch. */
  opened: boolean[];
  spent: boolean[];
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
  | { readonly ok: false; readonly reason: 'finished' | 'invalid-tube' | 'same-tube' | 'empty' | 'full' | 'different-color' | 'capped' | 'spent' };

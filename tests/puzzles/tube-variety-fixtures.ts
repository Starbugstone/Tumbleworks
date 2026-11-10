import type { TubeMove } from '../../src/puzzles/types';

/** Actual legal paths ending with no possible move, indexed by permanent level ID. */
export const TUBE_VARIETY_JAMS: Readonly<Record<string, readonly TubeMove[]>> = {
  'tube-210': [{ from: 2, to: 3 }],
  'tube-211': [{ from: 0, to: 3 }, { from: 2, to: 0 }],
};

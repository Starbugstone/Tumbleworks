import { tubeColorCapacity, tubeContainer } from './rules';
import type { TubeDef } from './types';
import type { Color } from '../sim/types';

/**
 * Which colours each home is sized for, when its size differs from the board's usual one. Those homes carry the colour's
 * pattern above their rail; every home of the usual size, and so every campaign board today, carries none.
 */
export function homePlaques(board: TubeDef): readonly (readonly Color[])[] {
  const colors = [...new Set(board.tubes.flat())];
  return board.tubes.map((_, index) => {
    const container = tubeContainer(board, index);
    if (container.role === 'cup' || container.capacity === board.capacity) return [];
    return colors.filter((color) => tubeColorCapacity(board, color) === container.capacity);
  });
}

import type { TubeDef } from './types';

const PITCH_X = 3.8;
const PITCH_Z = 4.8;

/** Place tubes in board order, centring each row around the same axis. */
export function tubeRack(board: Pick<TubeDef, 'tubes' | 'rows'>) {
  const count = board.tubes.length;
  const rows = board.rows ?? Array.from({ length: Math.ceil(count / 2) }, (_, i) => Math.min(2, count - i * 2));
  if (!Array.isArray(rows) || rows.length === 0 || rows.some(n => !Number.isSafeInteger(n) || n < 1) ||
      rows.reduce((sum, n) => sum + n, 0) !== count) {
    throw new Error('Rack rows must contain a positive whole number of tubes and fit the board exactly');
  }
  const places = rows.flatMap((width, row) => Array.from({ length: width }, (_, column) => ({
    x: (column - (width - 1) / 2) * PITCH_X,
    z: (row - 1) * PITCH_Z,
  })));
  const halfWidth = (Math.max(...rows) - 1) * PITCH_X / 2 + 2.2;
  const center = (rows.length - 1) * PITCH_Z / 2 - PITCH_Z + .3;
  const depth = rows.length * PITCH_Z + .8;
  return { places, halfWidth, back: center - depth / 2, front: center + depth / 2 };
}

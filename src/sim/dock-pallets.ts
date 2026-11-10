import type { Color } from './types';

/** Adjacent queues share each pair of front boxes, including their final pair. */
export type DockPallet = readonly [number, number];

export function validateDockPallets(docks: readonly (readonly Color[])[], pallets: readonly DockPallet[]): void {
  const used = new Set<number>();
  for (const pair of pallets) {
    if (pair.length !== 2) throw new Error('A pallet needs exactly two docks');
    const [a, b] = pair;
    if (![a, b].every((dock) => Number.isSafeInteger(dock) && dock >= 0 && dock < docks.length)) {
      throw new Error('Unknown pallet dock');
    }
    if (Math.abs(a - b) !== 1) throw new Error('Pallet docks must be adjacent');
    if (used.has(a) || used.has(b)) throw new Error('Overlapping dock pallets');
    if (!docks[a]?.length || docks[a].length !== docks[b]?.length) throw new Error('Pallet queues must have equal nonzero lengths');
    used.add(a);
    used.add(b);
  }
}

export function palletMate(pallets: readonly DockPallet[] | undefined, dock: number): number | null {
  if (!pallets) return null;
  for (const [a, b] of pallets) {
    if (a === dock) return b;
    if (b === dock) return a;
  }
  return null;
}

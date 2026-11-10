export interface ValleyViewport { readonly width: number; readonly height: number }
export interface ValleyPlacement {
  readonly chapter: number;
  readonly position: readonly [number, number, number];
  readonly label: readonly [number, number, number];
}
export interface ValleyLayout {
  readonly firstRow: number;
  readonly maxFirstRow: number;
  readonly cameraDistance: number;
  readonly labelWidth: number;
  readonly villages: readonly ValleyPlacement[];
}

/** Keep the miniature's scale as the campaign grows; later villages enter a six-place window. */
export function worldLayout(count: number, viewport: ValleyViewport, firstRow = 0): ValleyLayout {
  if (!Number.isInteger(count) || count < 0 || !Number.isFinite(firstRow) || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) throw new Error('Invalid valley layout');
  const maxFirstRow = Math.max(0, Math.ceil(count / 2) - 3);
  const start = Math.max(0, Math.min(maxFirstRow, Math.trunc(firstRow)));
  const visible = Math.min(6, count - start * 2);
  const rows = Math.ceil(visible / 2);
  const villages: ValleyPlacement[] = Array.from({ length: visible }, (_, index) => {
    const row = Math.floor(index / 2), side = index % 2;
    const z = rows <= 1 ? 0 : 10.3 - row * 20.6 / (rows - 1) - side * 1.1;
    const x = side === 0 ? -4.7 : 4.7;
    const y = 0.8 + (10 - z) * 0.2;
    return { chapter: start * 2 + index, position: [x, y, z], label: [x, y - 0.05, z + 2.5] };
  });
  return { firstRow: start, maxFirstRow,
    cameraDistance: Math.max(66, 35.87 * viewport.height / viewport.width),
    labelWidth: Math.min(142, (viewport.width - 48) / 2), villages };
}

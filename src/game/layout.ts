import type { Color } from '../sim/types';

/** All game code draws in this portrait space. */
export const LOGICAL_WIDTH = 720;
export const LOGICAL_HEIGHT = 1280;
/** The canvas renders above logical size so it stays sharp on high-density phones. */
export const RENDER_SCALE = 1.5;
export const GAME_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;

const MAX_EXTRA_HEIGHT = 170;
/**
 * Logical pixels of spare room above and below the layout on phones taller than 9:16.
 * Read once at boot, because the header and buttons are placed from it.
 */
export const EXTRA_HEIGHT = Math.min(
  Math.max((LOGICAL_WIDTH * (window.innerHeight / window.innerWidth) - LOGICAL_HEIGHT) / 2, 0),
  MAX_EXTRA_HEIGHT,
);
export const GAME_HEIGHT = Math.round((LOGICAL_HEIGHT + 2 * EXTRA_HEIGHT) * RENDER_SCALE);

export const FONT = 'Fredoka, "Trebuchet MS", sans-serif';
export const INK = '#2f3358';
export const INK_SOFT = '#6d6a7c';

export interface Palette {
  readonly base: string;
  readonly light: string;
  readonly dark: string;
  readonly hex: number;
}

export const COLORS: Record<Color, Palette> = {
  red: { base: '#e8413c', light: '#ff9c8c', dark: '#9c1320', hex: 0xe8413c },
  blue: { base: '#2d7df6', light: '#8cc4ff', dark: '#123f9e', hex: 0x2d7df6 },
  green: { base: '#27b35a', light: '#8ceaa6', dark: '#0d6b33', hex: 0x27b35a },
  yellow: { base: '#fbc02d', light: '#fff0a0', dark: '#b9780a', hex: 0xfbc02d },
};
export const COLOR_NAMES: Record<Color, string> = { red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow' };

export const DEPTH = {
  background: 0,
  track: 10,
  chevrons: 11,
  gates: 12,
  box: 30,
  tray: 30,
  shadow: 35,
  marble: 40,
  gate: 45,
  hud: 60,
  card: 70,
  flying: 80,
  fx: 90,
} as const;

export const TRACK = { cx: 360, cy: 680, straightHalf: 124, radius: 172, bandHalf: 37 } as const;

export const MARBLE_SIZE = { belt: 56, tray: 44, box: 58 } as const;

export const TRAY = { width: 186, height: 132, frontY: 306, nextY: 170, nextScale: 0.62 } as const;
/** Socket offsets for the six marbles in a tray, at full tray scale. */
export const TRAY_SLOTS = [
  { x: -56, y: -26 },
  { x: 0, y: -26 },
  { x: 56, y: -26 },
  { x: -56, y: 26 },
  { x: 0, y: 26 },
  { x: 56, y: 26 },
] as const;

export const supplyX = (index: number, count: number): number =>
  count === 2 ? [190, 530][index]! : [130, 360, 590][index]!;

export const ENTRY_GATE_Y = 452;

export const BOX = { width: 234, height: 112, frontY: 1012, slotSpacing: 72 } as const;
export const QUEUE = { leftX: 366, y: 1022, rowGap: 72, perRow: 5, size: 58, gap: 8 } as const;

export const BUTTONS = { y: 1196, height: 88, width: 300, undoX: 196, restartX: 524 } as const;

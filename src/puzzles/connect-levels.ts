import type { Color } from '../sim/types';
import type { ConnectDef } from './connect';
const colors: Record<string, Color> = { r: 'red', b: 'blue', g: 'green', y: 'yellow' };
const columns = (values: readonly string[]): Color[][] => values.map((column) => [...column].map((letter) => {
  const color = colors[letter];
  if (!color) throw new Error(`Unknown marble ${letter}`);
  return color;
}));
export const CONNECT_BOARDS: readonly ConnectDef[] = [
  { id: 'connect-1', title: 'Side by side', columns: columns(['rrrr', 'bgbr', 'ggbb', 'rrrb']), maxMoves: 5, solution: [0, 5, 12, 4] },
  { id: 'connect-2', title: 'Bring them together', columns: columns(['bybrb', 'ryrrb', 'bybrr', 'gyybr', 'ggryr']), maxMoves: 5, solution: [15, 1, 3, 0, 19] },
  { id: 'connect-3', title: 'Every move counts', columns: columns(['gygggg', 'bggygg', 'byybry', 'rrygyy', 'rrggyr', 'yygyyr']), maxMoves: 7, solution: [21, 13, 6, 16, 2, 0, 1] },
];

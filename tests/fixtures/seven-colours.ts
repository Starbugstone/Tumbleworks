import type { App } from '../../src/view/App';
import { ConveyorRuntime } from '../../src/gameplays/conveyor';
import { LoopRuntime } from '../../src/gameplays/loop';
import { TubeRuntime } from '../../src/gameplays/tube';
import { COLORS, type BoardDef, type Color } from '../../src/sim/types';
import type { LoopBoardDef } from '../../src/loop/types';
import type { TubeDef } from '../../src/puzzles/types';

/** Render-only fixtures, deliberately outside the campaign and production module graph. */
export const FUNNEL_COLOURS: BoardDef = {
  id: 'test-seven-funnel', title: 'Seven colours', beltCapacity: 20, boxSize: 3,
  supplies: ([['black', 'red'], ['white', 'blue'], ['orange', 'green'], ['yellow']] satisfies Color[][]).map((queue) =>
    queue.map((color) => ({ color, count: 9 }))),
  docks: [['red', 'red', 'red', 'black', 'black', 'black'], ['blue', 'blue', 'blue', 'white', 'white', 'white'],
    ['green', 'green', 'green', 'orange', 'orange', 'orange'], ['yellow', 'yellow', 'yellow']],
};
const homes: readonly (readonly Color[])[] = [['black', 'red'], ['white', 'blue'], ['green', 'orange'], ['yellow']];
export const LOOP_COLOURS: LoopBoardDef = {
  id: 'test-seven-loop', title: 'Seven colours', loopCapacity: 28, truckCapacity: 24,
  lanes: homes.map((queue) => queue.map((color) => ({ segments: [
    { color: COLORS[(COLORS.indexOf(color) + 1) % COLORS.length]!, count: 8 }, { color, count: 14 },
  ] }))),
  loop: COLORS.map((color) => ({ color, count: 2 })),
};
export const TUBE_COLOURS: TubeDef = {
  kind: 'tube', id: 'test-seven-tube', title: 'Seven colours', capacity: 4,
  tubes: [...COLORS.map((color, index) => [color, color, COLORS[(index + 1) % COLORS.length]!, COLORS[(index + 1) % COLORS.length]!]), [], []],
  solution: [],
};
export type ColourGame = 'funnel' | 'loop' | 'tube';
export function installColours(app: App, kind: ColourGame): void {
  app.manualClock = true;
  app.runtime.dispose();
  app.runtime = kind === 'funnel' ? new ConveyorRuntime(FUNNEL_COLOURS, app.services)
    : kind === 'loop' ? new LoopRuntime(LOOP_COLOURS, app.services) : new TubeRuntime(TUBE_COLOURS, app.services);
  app.runtime.resize();
  app.advance(0);
}

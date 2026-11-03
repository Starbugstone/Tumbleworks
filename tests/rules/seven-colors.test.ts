import { afterEach, describe, expect, it } from 'vitest';
import { stateKey as funnelKey } from '../../scripts/funnel-author';
import { stateKey as loopKey } from '../../scripts/loop-author';
import { loopGraphKey, loopOrderKey } from '../../scripts/level-score';
import { COLORS, COLOR_CODE, type BoardDef, type Color } from '../../src/sim/types';
import { MachineRules } from '../../src/sim/rules';
import { LoopRules } from '../../src/loop/rules';
import { TubeRules, validateTubeDef } from '../../src/puzzles/rules';
import type { TubeDef } from '../../src/puzzles/types';
import { colorName, patternName } from '../../src/i18n';
import { setLocale } from '../../src/preferences';
import { drawSymbol } from '../../src/view/art';

const seven = ['red', 'blue', 'green', 'yellow', 'orange', 'black', 'white'] as const;
afterEach(() => setLocale('en'));

describe('seven-colour support', () => {
  it('registers the neutrals with collision-free codes', () => {
    expect(COLORS).toEqual(seven);
    expect(COLOR_CODE).toMatchObject({ blue: 'b', black: 'k', white: 'w' });
  });

  it('keeps blue and black pending pours distinct in Funnel Sort authoring', () => {
    const key = (color: Color) => {
      const board: BoardDef = { id: 'key', title: 'Key', beltCapacity: 14, boxSize: 3,
        supplies: [[{ color, count: 3 }]], docks: [[color]] };
      const rules = new MachineRules(board);
      expect(rules.release(0).ok).toBe(true);
      return funnelKey(rules);
    };
    expect(key('blue')).not.toBe(key('black'));
  });

  it('keeps blue and black truck segments distinct in Loop Sort authoring and scoring', () => {
    const rules = (color: Color) => new LoopRules({ id: 'key', title: 'Key', loopCapacity: 20, truckCapacity: 6, loop: [],
      lanes: [[{ segments: [{ color, count: 3 }, { color: 'red', count: 3 }] }],
        [{ segments: [{ color: 'red', count: 3 }, { color, count: 3 }] }]] });
    for (const key of [loopKey, loopGraphKey, (game: LoopRules) => loopOrderKey(game.state)]) expect(key(rules('blue'))).not.toBe(key(rules('black')));
  });

  it('names every colour and pattern in both languages', () => {
    for (const language of ['en', 'fr'] as const) {
      setLocale(language);
      expect(new Set(seven.map(colorName)).size).toBe(7);
      expect(new Set(seven.map(patternName)).size).toBe(7);
      expect(seven.map(colorName).every(Boolean)).toBe(true);
      expect(seven.map(patternName).every(Boolean)).toBe(true);
      expect([colorName('black'), colorName('white'), patternName('black'), patternName('white')])
        .toEqual(language === 'en' ? ['black', 'white', 'Dots', 'Heart'] : ['noir', 'blanc', 'Points', 'Cœur']);
    }
  });

  it('draws seven distinct filled patterns, including three dots and a heart', () => {
    const commands = (color: Color) => {
      const calls: { name: string; args: unknown[] }[] = [];
      const context = new Proxy({}, { get: (_, name) => (...args: unknown[]) => calls.push({ name: String(name), args }) });
      drawSymbol(context as CanvasRenderingContext2D, color, 0, 0, 10);
      return calls;
    };
    expect(new Set(seven.map((color) => JSON.stringify(commands(color)))).size).toBe(7);
    expect(commands('black').filter((call) => call.name === 'arc').map((call) => call.args.slice(0, 3)))
      .toEqual([[-7.800000000000001, 0, 3], [0, 0, 3], [7.800000000000001, 0, 3]]);
    expect(commands('white').filter((call) => call.name === 'bezierCurveTo')).toHaveLength(2);
    for (const color of seven) expect(commands(color)).toContainEqual({ name: 'fill', args: ['evenodd'] });
  });

  it('validates, transfers and restores seven-colour Tube Sort contents', () => {
    const board: TubeDef = { kind: 'tube', id: 'seven', title: 'Seven', capacity: 2,
      tubes: [...seven.map((color, index) => [color, seven[(index + 1) % 7]!]), []], solution: [] };
    expect(() => validateTubeDef(board)).not.toThrow();
    const rules = new TubeRules(board);
    const before = rules.snapshot();
    expect(rules.move(5, 7)).toMatchObject({ ok: true, color: 'white' });
    rules.restore(before);
    expect(rules.state.tubes).toEqual(board.tubes);
    expect(() => validateTubeDef({ ...board, tubes: [['purple' as Color]] })).toThrow(/contents/);
  });
});

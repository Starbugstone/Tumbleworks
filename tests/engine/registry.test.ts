import { describe, expect, it } from 'vitest';
import { SLOTS } from '../../scripts/level-slots';
import { CAMPAIGN, PLAY_ORDER } from '../../src/campaign';
import { CampaignRegistry, type Feedback, type GameLevel, type GameRuntime, type GameServices } from '../../src/engine/contracts';
import { PhysicsService } from '../../src/engine/physics';
import type { Color } from '../../src/sim/types';
import { BOARDS } from '../../src/sim/boards';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { TUBE_BOARDS } from '../../src/puzzles/levels';

class SpinRuntime implements GameRuntime {
  readonly game = { steps: 0, actions: [], step: () => undefined, perform: () => false, fingerprint: () => '' };
  private turns = 0;
  readonly busy = false;
  readonly preview: readonly Color[] = [];
  readonly previewLabel = '';
  readonly jamReason = '';
  readonly frames: { alpha: number; seconds: number }[] = [];
  resizes = 0;
  disposed = false;

  constructor(readonly services: GameServices) {}
  get status(): 'playing' | 'won' { return this.turns === 2 ? 'won' : 'playing'; }
  get canUndo(): boolean { return this.turns > 0; }
  get counter() { return { label: 'Turns', value: String(this.turns) }; }
  activate(target: string): readonly Feedback[] {
    if (target !== 'spin' || this.status === 'won') return [];
    this.turns += 1;
    return [{ type: this.turns === 2 ? 'match' : 'move' }];
  }
  pick(x: number, y: number): string | null { return x === 100 && y === 120 ? 'spin' : null; }
  hint(): readonly Feedback[] { return [{ type: 'message', text: 'Turn the wheel twice.', target: 'spin' }]; }
  undo(): boolean {
    if (!this.canUndo) return false;
    this.turns -= 1;
    return true;
  }
  step(): readonly Feedback[] { return []; }
  render(alpha: number, seconds: number): void { this.frames.push({ alpha, seconds }); }
  resize(): void { this.resizes += 1; }
  targets() { return { spin: { x: 100, y: 120, label: 'Turn the wheel' } }; }
  inspect() { return { turns: this.turns }; }
  dispose(): void { this.disposed = true; }
}

function syntheticLevel(kind: string, id: string): GameLevel {
  return {
    id, kind, name: 'Spin', title: id, difficulty: 'Getting started', instructions: 'Turn the wheel twice.',
    create: (services) => new SpinRuntime(services),
  };
}

describe('gameplay registry', () => {
  it('registers the first stretch in play order, one level per game per round', () => {
    const rounds = 12;
    const expected: string[] = [];
    for (let round = 0; round < rounds; round++) expected.push(PLAY_ORDER.conveyor[round]!, PLAY_ORDER.loop[round]!, PLAY_ORDER.tube[round]!);
    expect(CAMPAIGN.map((level) => level.id)).toEqual(expected);
    expect(CAMPAIGN).toHaveLength(36);
    expect(CAMPAIGN.slice(0, 6).map((level) => level.id)).toEqual(['board-1', 'loop-1', 'tube-1', 'board-31', 'loop-2', 'tube-31']);
    expect([...new Set(CAMPAIGN.map((level) => level.kind))]).toEqual(['conveyor', 'loop', 'tube']);
  });

  it('keeps every definition in its bank, so retired boards can come back and old saves stay harmless', () => {
    const ids = (bank: readonly { readonly id: string }[]): string[] => bank.map((board) => board.id);
    for (let round = 1; round <= 30; round++) {
      expect(ids(BOARDS)).toContain(`board-${round}`);
      expect(ids(LOOP_BOARDS)).toContain(`loop-${round}`);
      expect(ids(TUBE_BOARDS)).toContain(`tube-${round}`);
    }
  });

  it('keeps the opening tiers gentle and brings each new colour in on time', () => {
    const colors = new Map<string, Set<Color>>();
    for (const board of BOARDS) colors.set(board.id, new Set(board.supplies.flat().map((tray) => tray.color)));
    for (const board of LOOP_BOARDS) colors.set(board.id, new Set([...board.lanes.flat().flatMap((truck) => truck.segments.map((segment) => segment.color)), ...board.loop.map((entry) => entry.color)]));
    for (const board of TUBE_BOARDS) colors.set(board.id, new Set(board.tubes.flat()));
    for (const level of CAMPAIGN) {
      expect(level.difficulty === 'Full spectrum', level.id).toBe(colors.get(level.id)?.has('orange') ?? false);
    }
    expect(CAMPAIGN.slice(0, 5).map((level) => level.difficulty)).toEqual(Array(5).fill('Getting started'));
    expect(CAMPAIGN[5]?.difficulty).toBe('Finding a rhythm');
    // Rounds 1 to 3 stay on three colours. Orange, the fifth, comes in from round 7 and always on a lesson level.
    const first = (kind: string, color: Color): number => CAMPAIGN.filter((level) => level.kind === kind).findIndex((level) => colors.get(level.id)?.has(color)) + 1;
    const kinds = ['conveyor', 'loop', 'tube'];
    expect(kinds.map((kind) => first(kind, 'yellow'))).toEqual([5, 4, 6]);
    expect(kinds.map((kind) => first(kind, 'orange'))).toEqual([7, 7, 10]);
    for (const kind of kinds) {
      const opening = CAMPAIGN.filter((level) => level.kind === kind)[first(kind, 'orange') - 1]!;
      expect(SLOTS[opening.id], opening.id).toBe('lesson');
    }
  });

  it('adds another runtime factory to the real campaign without special engine branches', () => {
    const registry = new CampaignRegistry();
    for (const kind of new Set(CAMPAIGN.map((level) => level.kind))) {
      registry.register({ kind, levels: CAMPAIGN.filter((level) => level.kind === kind) });
    }
    registry.register({ kind: 'spin', levels: [syntheticLevel('spin', 'spin-1'), syntheticLevel('spin', 'spin-2')] });
    const levels = registry.levels();
    const kinds = [...new Set(CAMPAIGN.map((level) => level.kind)), 'spin'];
    const rounds = Math.max(...kinds.map((kind) => levels.filter((level) => level.kind === kind).length));
    const expected: string[] = [];
    for (let round = 0; round < rounds; round++) {
      for (const kind of kinds) {
        const id = kind === 'spin' ? [`spin-1`, `spin-2`][round] : CAMPAIGN.filter((level) => level.kind === kind)[round]?.id;
        if (id) expected.push(id);
      }
    }
    expect(levels.map((level) => level.id)).toEqual(expected);
    expect(levels.slice(0, kinds.length).map((level) => level.kind)).toEqual(kinds);
    const extra = levels.find((level) => level.id === 'spin-1');
    if (!extra) throw new Error('Extra gameplay is missing');
    const services: GameServices = {
      physics: new PhysicsService(),
      get stage(): never { throw new Error('This headless gameplay never requests a renderer'); },
    };
    const runtime = extra.create(services);
    expect(runtime).toBeInstanceOf(SpinRuntime);
    expect(runtime.status).toBe('playing');
    expect(runtime.hint()).toEqual([{ type: 'message', text: 'Turn the wheel twice.', target: 'spin' }]);
    const target = runtime.targets()['spin'];
    if (!target) throw new Error('Extra gameplay did not expose input');
    const picked = runtime.pick(target.x, target.y);
    if (!picked) throw new Error('Extra gameplay did not recognize its target');
    expect(runtime.activate(picked)).toEqual([{ type: 'move' }]);
    expect(runtime.counter).toEqual({ label: 'Turns', value: '1' });
    runtime.step(); runtime.render(0.5, 1 / 60); runtime.resize();
    expect(runtime.activate(picked)).toEqual([{ type: 'match' }]);
    expect(runtime.status).toBe('won');
    expect(runtime.undo()).toBe(true);
    expect(runtime.inspect()).toEqual({ turns: 1 });
    runtime.dispose();
    if (!(runtime instanceof SpinRuntime)) throw new Error('Wrong runtime factory');
    expect(runtime.services).toBe(services);
    expect(runtime.frames).toEqual([{ alpha: 0.5, seconds: 1 / 60 }]);
    expect(runtime.resizes).toBe(1);
    expect(runtime.disposed).toBe(true);
  });

  it('interleaves uneven and empty banks without holes or duplicate levels', () => {
    const registry = new CampaignRegistry()
      .register({ kind: 'a', levels: [syntheticLevel('a', 'a1'), syntheticLevel('a', 'a2'), syntheticLevel('a', 'a3')] })
      .register({ kind: 'empty', levels: [] })
      .register({ kind: 'b', levels: [syntheticLevel('b', 'b1')] });
    expect(registry.levels().map((level) => level.id)).toEqual(['a1', 'b1', 'a2', 'a3']);
    expect(new CampaignRegistry().levels()).toEqual([]);
  });

  it('rejects duplicate gameplay kinds and level IDs across and within packs', () => {
    const registry = new CampaignRegistry().register({ kind: 'a', levels: [syntheticLevel('a', 'shared')] });
    expect(() => registry.register({ kind: 'a', levels: [] })).toThrow();
    expect(() => registry.register({ kind: '', levels: [] })).toThrow();
    expect(() => registry.register({ kind: 'b', levels: [syntheticLevel('b', 'shared')] })).toThrow();
    expect(() => registry.register({ kind: 'b', levels: [syntheticLevel('b', 'new'), syntheticLevel('b', 'new')] })).toThrow();
    expect(() => registry.register({ kind: 'b', levels: [syntheticLevel('b', '')] })).toThrow();
    expect(registry.levels().map((level) => level.id)).toEqual(['shared']);
  });

  it('rejects a mismatched kind atomically and lets a corrected pack register', () => {
    const registry = new CampaignRegistry().register({ kind: 'a', levels: [syntheticLevel('a', 'a1')] });
    expect(() => registry.register({ kind: 'b', levels: [syntheticLevel('b', 'b1'), syntheticLevel('other', 'b2')] })).toThrow();
    expect(registry.levels().map((level) => level.id)).toEqual(['a1']);
    expect(() => registry.register({ kind: 'b', levels: [syntheticLevel('b', 'b1')] })).not.toThrow();
    expect(registry.levels().map((level) => level.id)).toEqual(['a1', 'b1']);
  });
});

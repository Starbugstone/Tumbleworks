import type { Feedback, GameRuntime, GameServices, ScreenPoint } from '../engine/contracts';
import type { Point3 } from '../engine/physics';
import { TubeRules } from '../puzzles/rules';
import type { TubeDef } from '../puzzles/types';
import { marbleName } from '../view/art';
import { TubeView } from '../view/tubes';

export class TubeRuntime implements GameRuntime {
  readonly rules: TubeRules;
  private readonly view: TubeView;
  private selected: number | null = null;
  private completedMove = false;
  private dragFrom: number | null = null;
  readonly drag = {
    start: (target: string, point: ScreenPoint): boolean => {
      const index = this.index(target);
      if (this.status !== 'playing' || index === null || !this.rules.state.tubes[index]?.length) return false;
      this.dragFrom = index;
      this.view.beginDrag(index, this.rules.state, point);
      return true;
    },
    move: (point: ScreenPoint, target: string | null): void => {
      const to = this.index(target);
      const source = this.dragFrom === null ? undefined : this.rules.state.tubes[this.dragFrom];
      const destination = to === null ? undefined : this.rules.state.tubes[to];
      const valid = destination && destination.length < this.board.capacity && (!destination.length || destination.at(-1) === source?.at(-1));
      this.view.moveDrag(point, valid && to !== null ? to : this.dragFrom ?? -1);
    },
    end: (target: string | null): readonly Feedback[] => {
      const from = this.dragFrom;
      const to = this.index(target);
      const starts = this.view.endDrag(this.rules.state);
      this.dragFrom = null;
      this.view.select(this.selected ?? -1);
      return from !== null && to !== null && from !== to ? this.transfer(from, to, starts) : [];
    },
    cancel: (): void => {
      if (this.dragFrom === null) return;
      this.dragFrom = null;
      this.view.endDrag(this.rules.state);
      this.view.select(this.selected ?? -1);
    },
  };

  private index(target: string | null): number | null {
    if (target === null || !/^tube\d+$/.test(target)) return null;
    const index = Number(target.slice(4));
    return this.rules.state.tubes[index] ? index : null;
  }

  constructor(readonly board: TubeDef, services: GameServices) {
    this.rules = new TubeRules(board);
    this.view = new TubeView(services, board, this.rules.state);
  }
  get status() { return this.rules.status; }
  get busy() { return this.view.busy; }
  get canUndo() { return this.rules.canUndo; }
  get counter() {
    const complete = this.rules.state.tubes.filter((tube) => tube.length === this.board.capacity && tube.every((c) => c === tube[0])).length;
    const colors = new Set(this.board.tubes.flat()).size;
    return { label: 'Sorted', value: `${complete} / ${colors}` };
  }
  readonly preview = [];
  readonly previewLabel = '';
  readonly jamReason = 'No top marble can move. Undo a move to make room, or restart this board.';

  activate(target: string): readonly Feedback[] {
    if (this.status !== 'playing') return [];
    const index = Number(target.replace(/^tube/, ''));
    if (!/^tube\d+$/.test(target) || !this.rules.state.tubes[index]) return [];
    if (this.selected === null) {
      if (!this.rules.state.tubes[index]?.length) return [{ type: 'message', text: 'Choose a tube with a marble first.' }];
      this.selected = index;
      this.view.select(index);
      return [{ type: 'tap' }];
    }
    if (this.selected === index) {
      this.selected = null;
      this.view.select(-1);
      return [{ type: 'tap' }];
    }
    return this.transfer(this.selected, index);
  }

  private transfer(from: number, index: number, starts?: readonly Point3[]): readonly Feedback[] {
    const result = this.rules.move(from, index);
    if (!result.ok) {
      const text = result.reason === 'full' ? 'That tube is full.' : 'Choose an empty tube or the same top color.';
      // The destination becomes the next selected source, so correcting a choice takes one tap.
      if (!starts) this.selected = this.rules.state.tubes[index]?.length ? index : this.selected;
      this.view.select(this.selected ?? -1);
      return [{ type: 'blocked', text }];
    }
    this.selected = null;
    this.view.select(-1);
    this.completedMove = result.completedTube;
    this.view.moved(result, this.rules.state, starts);
    return [{ type: 'move' }];
  }

  step(): readonly Feedback[] {
    const busy = this.busy;
    this.view.step();
    if (busy && !this.busy) return [{ type: this.completedMove ? 'match' : 'deliver' }];
    return [];
  }
  hint(): readonly Feedback[] {
    const move = this.rules.hint();
    if (!move) return [{ type: 'message', text: 'No safe move found from here. Try undoing a move.' }];
    const color = this.rules.state.tubes[move.from]?.at(-1);
    return [{ type: 'message', text: `${color ? marbleName(color) : 'Marble'} group: tube ${move.from + 1} → tube ${move.to + 1}.`, target: `tube${move.from}` }];
  }
  undo(): boolean {
    if (!this.rules.undo()) return false;
    this.view.cancelMotion();
    this.selected = null;
    this.view.select(-1);
    this.view.rebuild(this.rules.state);
    return true;
  }
  pick(x: number, y: number) { return this.view.pick(x, y); }
  targets() { return Object.fromEntries(Object.entries(this.view.targets()).map(([key, point]) => [key, { ...point, label: `Tube ${Number(key.slice(4)) + 1}` }])); }
  render() { this.view.render(); }
  resize() { this.view.resize(); }
  inspect() { return { ...this.rules.snapshot(), selected: this.selected }; }
  dispose() { this.view.dispose(); }
}

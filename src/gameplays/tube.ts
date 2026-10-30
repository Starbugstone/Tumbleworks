import type { Feedback, GameRuntime, GameServices } from '../engine/contracts';
import { TubeRules } from '../puzzles/rules';
import type { TubeDef } from '../puzzles/types';
import { COLOR_NAMES } from '../view/art';
import { TubeView } from '../view/tubes';

export class TubeRuntime implements GameRuntime {
  readonly rules: TubeRules;
  private readonly view: TubeView;
  private selected: number | null = null;
  private completedMove = false;

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
    if (this.busy || this.status !== 'playing') return [];
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
    const result = this.rules.move(this.selected, index);
    if (!result.ok) {
      const text = result.reason === 'full' ? 'That tube is full.' : 'Choose an empty tube or a matching top color.';
      // The destination becomes the next selected source, so correcting a choice takes one tap.
      this.selected = this.rules.state.tubes[index]?.length ? index : this.selected;
      this.view.select(this.selected ?? -1);
      return [{ type: 'blocked', text }];
    }
    this.selected = null;
    this.view.select(-1);
    this.completedMove = result.completedTube;
    this.view.moved(result, this.rules.state);
    return [{ type: 'move' }];
  }

  step(): readonly Feedback[] {
    const busy = this.busy;
    this.view.step();
    if (busy && !this.busy) return [{ type: this.completedMove ? 'match' : 'deliver' }];
    return [];
  }
  hint(): readonly Feedback[] {
    if (this.busy) return [{ type: 'message', text: 'Let this marble land, then ask for a hint.' }];
    const move = this.rules.hint();
    if (!move) return [{ type: 'message', text: 'No safe move found from here. Try undoing a move.' }];
    const color = this.rules.state.tubes[move.from]?.at(-1);
    return [{ type: 'message', text: `${color ? COLOR_NAMES[color] : 'Marble'}: tube ${move.from + 1} → tube ${move.to + 1}.`, target: `tube${move.from}` }];
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

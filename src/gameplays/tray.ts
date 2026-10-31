import type { Feedback, GameRuntime, GameServices } from '../engine/contracts';
import { TrayRules } from '../puzzles/rules';
import type { TrayDef } from '../puzzles/types';
import { marbleName } from '../view/art';
import { TrayView } from '../view/tray';

export class TrayRuntime implements GameRuntime {
  readonly rules: TrayRules;
  private readonly view: TrayView;
  private matching = false;

  constructor(readonly board: TrayDef, services: GameServices) {
    this.rules = new TrayRules(board);
    this.view = new TrayView(services, board, this.rules.state);
  }
  get status() { return this.rules.status; }
  get busy() { return this.view.busy; }
  get canUndo() { return this.rules.canUndo; }
  get counter() { return { label: 'Rack', value: `${this.rules.state.rack.length} / ${this.board.rackCapacity}` }; }
  readonly preview = [];
  readonly previewLabel = '';
  readonly jamReason = 'All seven rack slots contain unmatched marbles. Undo a pick and finish a triple before starting another color.';

  activate(target: string): readonly Feedback[] {
    if (this.status !== 'playing' || !/^piece\d+$/.test(target)) return [];
    const id = Number(target.slice(5));
    const before = [...this.rules.state.rack];
    const result = this.rules.pick(id);
    if (!result.ok) return [{ type: 'blocked', text: result.reason === 'covered' ? 'Remove the marble resting above this one first.' : 'Choose an exposed marble.' }];
    this.matching = result.clearedIds.length > 0;
    this.view.picked(id, result, before, this.rules.state);
    return [{ type: 'move' }];
  }
  step(): readonly Feedback[] {
    const busy = this.busy;
    this.view.step();
    return busy && !this.busy ? [{ type: this.matching ? 'match' : 'deliver' }] : [];
  }
  hint(): readonly Feedback[] {
    const id = this.rules.hint();
    const piece = this.board.pieces.find((candidate) => candidate.id === id);
    return piece ? [{ type: 'message', text: `Pick the highlighted ${marbleName(piece.color).toLowerCase()} marble.`, target: `piece${piece.id}` }]
      : [{ type: 'message', text: 'No safe path found. Undo a pick to make room.' }];
  }
  undo(): boolean {
    if (!this.rules.undo()) return false;
    this.view.cancelMotion();
    this.view.rebuild(this.rules.state);
    return true;
  }
  pick(x: number, y: number) { return this.view.pick(x, y); }
  targets() { return Object.fromEntries(Object.entries(this.view.targets()).map(([key, point]) => {
    const id = Number(key.slice(5));
    const piece = this.board.pieces.find((candidate) => candidate.id === id);
    return [key, { ...point, label: `${piece ? marbleName(piece.color) : ''} marble ${id + 1}` }];
  })); }
  render() { this.view.render(); }
  resize() { this.view.resize(); }
  inspect() { return { ...this.rules.snapshot(), available: this.rules.available }; }
  dispose() { this.view.dispose(); }
}

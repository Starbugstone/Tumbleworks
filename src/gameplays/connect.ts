import type { Feedback, GameRuntime, GameServices } from '../engine/contracts';
import { ConnectRules, type ConnectDef } from '../puzzles/connect';
import { marbleName } from '../view/art';
import { ConnectView } from '../view/connect';

export class ConnectRuntime implements GameRuntime {
  readonly rules: ConnectRules;
  private readonly view: ConnectView;
  constructor(readonly board: ConnectDef, services: GameServices) {
    this.rules = new ConnectRules(board);
    this.view = new ConnectView(services, board, this.rules.snapshot());
  }
  get status() { return this.rules.status; }
  get busy() { return this.view.busy; }
  get canUndo() { return this.rules.canUndo; }
  get counter() { return { label: 'Moves left', value: `${this.board.maxMoves - this.rules.state.moves}` }; }
  readonly preview = [];
  readonly previewLabel = '';
  get jamReason() { return this.rules.state.moves >= this.board.maxMoves
    ? 'Out of moves. Clear larger connected groups to finish. Undo to try another order.'
    : 'No group of three remains connected along its sides. Undo to try another order.'; }
  activate(target: string): readonly Feedback[] {
    if (this.status !== 'playing' || !/^piece\d+$/.test(target)) return [];
    const ids = this.rules.pick(Number(target.slice(5)));
    if (!ids) return [{ type: 'blocked', text: 'Match at least three of one color touching along their sides. Diagonals do not connect.' }];
    this.view.cleared(ids, this.rules.snapshot());
    return [{ type: 'match' }];
  }
  step(): readonly Feedback[] { this.view.step(); return []; }
  hint(): readonly Feedback[] {
    const id = this.rules.hint();
    const color = id === null ? undefined : this.rules.color(id);
    return id !== null && color ? [{ type: 'message', text: `Clear this ${marbleName(color).toLowerCase()} group (${this.rules.group(id).length} marbles).`, target: `piece${id}` }]
      : [{ type: 'message', text: 'No winning path found. Undo to try a different group first.' }];
  }
  undo(): boolean {
    if (!this.rules.undo()) return false;
    this.view.rebuild(this.rules.snapshot()); return true;
  }
  pick(x: number, y: number) { return this.view.pick(x, y); }
  targets() { return Object.fromEntries(Object.entries(this.view.targets()).map(([key, point]) => {
    const id = Number(key.slice(5)); const color = this.rules.color(id);
    return [key, { ...point, label: `${color ? marbleName(color) : ''}, connected group of ${this.rules.group(id).length}` }];
  })); }
  render() { this.view.render(); }
  resize() { this.view.resize(); }
  inspect() { return { ...this.rules.snapshot() }; }
  dispose() { this.view.dispose(); }
}

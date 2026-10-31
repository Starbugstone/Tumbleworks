import type { Feedback, GameRuntime, GameServices } from '../engine/contracts';
import { Machine } from '../machine/machine';
import { columnX, STACK } from '../machine/layout';
import { hintConveyor } from '../sim/solver';
import type { BoardDef } from '../sim/types';
import { marbleName } from '../view/art';
import { MachineScene } from '../view/scene';

/** Funnel Sort: tip crates into the funnel; the belt never stops; fill every dock's boxes in order. */
export class ConveyorRuntime implements GameRuntime {
  readonly machine: Machine;
  private readonly view: MachineScene;
  private chain = 0;

  constructor(readonly board: BoardDef, services: GameServices) {
    this.machine = new Machine(board, services.physics);
    this.view = new MachineScene(services.stage);
    this.view.setMachine(this.machine);
  }
  get status() { return this.machine.rules.status; }
  get busy() { return this.machine.transferring; }
  get canUndo() { return this.machine.canUndo; }
  get counter() { return { label: 'Belt', value: `${this.machine.rules.occupancy}/${this.board.beltCapacity}${this.machine.rules.funnelCount ? ` · funnel ${this.machine.rules.funnelCount}` : ''}` }; }
  readonly preview = [];
  readonly previewLabel = '';
  get jamReason() {
    const wanted = this.board.docks.map((_, dock) => this.machine.rules.dockColor(dock)).filter((color) => color !== null);
    const names = [...new Set(wanted)].map((color) => marbleName(color).toLowerCase());
    return `The belt is full and the docks only want ${names.join(' or ') || 'nothing more'}. Undo a pour to keep a route open.`;
  }

  activate(target: string): readonly Feedback[] {
    if (!/^supply\d+$/.test(target) || this.status !== 'playing') return [];
    const result = this.machine.tap(Number(target.slice(6)));
    return result.ok ? [{ type: 'move' }] : [{ type: 'tap' }];
  }
  step(): readonly Feedback[] {
    const feedback: Feedback[] = [];
    for (const event of this.machine.step()) {
      switch (event.type) {
        case 'impact': feedback.push({ type: 'impact', strength: event.strength }); break;
        case 'kick': feedback.push({ type: 'deliver', slot: event.dock }); break;
        case 'captured':
          if (event.fill >= this.board.boxSize) feedback.push({ type: 'match' });
          else feedback.push({ type: 'tap' });
          break;
        case 'boxGone': this.chain++; break;
        default: break;
      }
    }
    this.view.afterTick();
    return feedback;
  }
  render(alpha: number): void { this.view.render(alpha); }
  resize(): void { this.view.resize(); }
  pick(x: number, y: number): string | null {
    const supply = this.view.pick(x, y);
    return supply === null ? null : `supply${supply}`;
  }
  hint(): readonly Feedback[] {
    if (this.status !== 'playing') return [];
    const supply = hintConveyor(this.machine.rules);
    if (supply === null) {
      return [{ type: 'message', text: this.machine.rules.canDrain() ? 'Wait: the belt is still draining.' : 'No verified pour from here. Try undoing a pour.' }];
    }
    const color = this.machine.rules.state.supplies[supply]?.[0]?.color;
    return [{ type: 'message', text: `Tip the ${color ? marbleName(color).toLowerCase() : ''} crate in column ${supply + 1}.`, target: `supply${supply}` }];
  }
  undo(): boolean {
    if (!this.machine.undo()) return false;
    this.view.syncAfterJump();
    return true;
  }
  targets() {
    const columns = this.board.supplies.length;
    return Object.fromEntries(this.board.supplies.flatMap((queue, supply) => {
      if (!queue.length) return [];
      const at = this.view.toScreen(columnX(supply, columns), STACK.y + 0.4, STACK.z);
      const color = queue[0]?.color;
      return [[`supply${supply}`, { ...at, label: `Column ${supply + 1}: ${color ? marbleName(color) : 'empty'}` }]];
    }));
  }
  inspect() {
    const rules = this.machine.rules;
    return { occupancy: rules.occupancy, funnel: rules.funnelCount, pending: [...rules.state.pending],
      supplies: rules.state.supplies.map((supply) => supply.map((packet) => packet.color)),
      docks: this.board.docks.map((_, dock) => rules.dockColor(dock)),
      recoveries: this.machine.recoveries, tick: this.machine.tick,
      settling: this.busy || rules.canDrain() };
  }
  dispose() { this.view.dispose(); this.machine.world.free(); }
}

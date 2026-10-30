import type { Feedback, GameRuntime, GameServices } from '../engine/contracts';
import { Machine } from '../machine/machine';
import { supplyX, TRAY } from '../machine/layout';
import { hintConveyor } from '../sim/solver';
import type { BoardDef } from '../sim/types';
import { COLOR_NAMES } from '../view/art';
import { MachineScene } from '../view/scene';

export class ConveyorRuntime implements GameRuntime {
  readonly machine: Machine;
  private readonly view: MachineScene;
  private firstTap: boolean;

  constructor(readonly board: BoardDef, services: GameServices, guided: boolean) {
    this.machine = new Machine(board, services.physics);
    this.view = new MachineScene(services.stage);
    this.view.setMachine(this.machine);
    this.firstTap = guided;
  }
  get status() { return this.machine.rules.status; }
  get busy() { return this.machine.transferring; }
  get canUndo() { return this.machine.canUndo; }
  get counter() { return { label: 'Belt', value: `${this.machine.rules.occupancy} / ${this.board.beltCapacity}` }; }
  get preview() { return this.board.boxes.slice(this.machine.activeBoxForView + 1, this.machine.activeBoxForView + 7); }
  readonly previewLabel = 'NEXT BOXES';
  get jamReason() {
    const color = this.machine.rules.activeColor ?? 'the next color';
    return `The next box needs ${color}, but the belt has no space to release it. Undo a pour to keep a route open.`;
  }

  activate(target: string): readonly Feedback[] {
    if (!/^supply\d+$/.test(target) || this.status !== 'playing') return [];
    const supply = Number(target.slice(6));
    if (this.firstTap && supply !== 0) return [{ type: 'message', text: 'Start with the blue tray to uncover red.', target: 'supply0' }];
    const result = this.machine.tap(supply);
    if (!result.ok) {
      if (result.reason === 'no-space') return [{ type: result.canDrain ? 'message' : 'blocked', text: `Needs ${result.needed} free spaces.${result.canDrain ? ' The belt is clearing.' : ''}` }];
      return [{ type: 'tap' }];
    }
    this.firstTap = false;
    return [{ type: 'move' }];
  }
  step(): readonly Feedback[] {
    const events = this.machine.step();
    this.view.afterTick();
    return events.flatMap((event): Feedback[] => {
      switch (event.type) {
        case 'impact': return [{ type: 'impact', strength: event.strength }];
        case 'captured': return [{ type: 'deliver', slot: event.fill - 1 }];
        case 'boxFull': return [{ type: 'match' }];
        default: return [];
      }
    });
  }
  hint(): readonly Feedback[] {
    const supply = hintConveyor(this.machine.rules);
    if (supply === null) return [{ type: 'message', text: this.busy || this.machine.rules.state.marbles.some((m) => m.status === 'on-belt' && m.color === this.machine.rules.activeColor)
      ? 'Let the matching marbles clear some space first.' : 'Try undoing a pour to make room for the next color.' }];
    const color = this.machine.rules.state.supplies[supply]?.[0]?.color;
    return [{ type: 'message', text: `Tip tray ${String.fromCharCode(65 + supply)}${color ? `: ${COLOR_NAMES[color]}` : ''}.`, target: `supply${supply}` }];
  }
  undo(): boolean {
    if (!this.machine.undo()) return false;
    this.firstTap = false;
    this.view.syncAfterJump();
    return true;
  }
  pick(x: number, y: number) {
    const supply = this.view.pick(x, y);
    return supply === null ? null : `supply${supply}`;
  }
  targets() {
    return Object.fromEntries(this.board.supplies.map((_, supply) => [`supply${supply}`,
      { ...this.view.toScreen(supplyX(supply, this.board.supplies.length), TRAY.frontY + 0.4, TRAY.frontZ - 1.2),
        label: `Tray ${String.fromCharCode(65 + supply)}` }]));
  }
  render(alpha: number, seconds: number) { this.view.render(alpha, seconds); }
  resize() { this.view.resize(); }
  inspect() {
    return { occupancy: this.machine.rules.occupancy, activeBox: this.machine.rules.activeBox,
      supplies: this.machine.rules.state.supplies.map((supply) => supply.map((packet) => packet.color)),
      recoveries: this.machine.recoveries, tick: this.machine.tick,
      settling: this.busy || this.machine.rules.state.marbles.some((m) => m.status === 'on-belt' && m.color === this.machine.rules.activeColor) };
  }
  dispose() { this.view.dispose(); this.machine.world.free(); }
}

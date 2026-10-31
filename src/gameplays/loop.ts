import type { Feedback, GameRuntime, GameServices } from '../engine/contracts';
import { DECK_TOP, TRUCK } from '../loop/layout';
import { LoopMachine } from '../loop/machine';
import { hintLoop } from '../loop/solver';
import type { LoopBoardDef } from '../loop/types';
import { marbleName } from '../view/art';
import { LoopScene } from '../view/loop-scene';

/** Loop Sort: trucks take their loop-end colour as it passes; tap one to pour that segment back out. */
export class LoopRuntime implements GameRuntime {
  readonly machine: LoopMachine;
  private readonly view: LoopScene;

  constructor(readonly board: LoopBoardDef, services: GameServices) {
    this.machine = new LoopMachine(board);
    this.view = new LoopScene(services.stage);
    this.view.setMachine(this.machine);
  }
  get status() { return this.machine.rules.status; }
  get busy() { return this.machine.transferring; }
  get canUndo() { return this.machine.canUndo; }
  get counter() {
    return { label: 'Loop', value: `${this.machine.rules.occupancy}/${this.board.loopCapacity}` };
  }
  readonly preview = [];
  readonly previewLabel = '';
  get jamReason() {
    const wanted = [...new Set(this.board.lanes.map((_, lane) => this.machine.rules.wants(lane)).filter((want): want is Exclude<typeof want, null | 'any'> => want !== null && want !== 'any'))];
    return `The loop is full and the trucks only take ${wanted.map((color) => marbleName(color).toLowerCase()).join(' or ') || 'nothing right now'}. Undo a pour to free the line.`;
  }

  activate(target: string): readonly Feedback[] {
    if (!/^lane\d+$/.test(target) || this.status !== 'playing') return [];
    const result = this.machine.tap(Number(target.slice(4)));
    if (result.ok) return [{ type: 'move' }];
    if (result.reason === 'single') return [{ type: 'blocked', text: 'That truck is one color: it only needs to fill up.' }];
    if (result.reason === 'busy') return [{ type: 'tap', text: this.machine.rules.free <= 0 ? 'The loop is full: a truck has to take some before more can pour.' : 'Still pouring.' }];
    return [{ type: 'tap' }];
  }
  step(): readonly Feedback[] {
    const feedback: Feedback[] = [];
    const events = this.machine.step();
    this.view.react(events);
    for (const event of events) {
      switch (event.type) {
        case 'absorb': if (event.fill % 3 === 0) feedback.push({ type: 'deliver', slot: event.lane }); break;
        case 'complete': feedback.push({ type: 'match' }); break;
        case 'enter': if (event.unit % 2 === 0) feedback.push({ type: 'impact', strength: 0.12 }); break;
        default: break;
      }
    }
    this.view.afterTick();
    return feedback;
  }
  render(alpha: number): void { this.view.render(alpha); }
  resize(): void { this.view.resize(); }
  pick(x: number, y: number): string | null {
    const lane = this.view.pick(x, y);
    return lane === null ? null : `lane${lane}`;
  }
  hint(): readonly Feedback[] {
    if (this.status !== 'playing') return [];
    const lane = hintLoop(this.machine.rules);
    if (lane === null) {
      return [{ type: 'message', text: this.machine.rules.canDrain() ? 'Wait: the loop is still unloading into the trucks.' : 'No verified pour from here. Try undoing a pour.' }];
    }
    const color = this.machine.rules.front(lane)?.segments[0]?.color;
    return [{ type: 'message', text: `Pour the ${color ? marbleName(color).toLowerCase() : ''} out of truck ${lane + 1}.`, target: `lane${lane}` }];
  }
  undo(): boolean {
    if (!this.machine.undo()) return false;
    this.view.syncAfterJump();
    return true;
  }
  targets() {
    return Object.fromEntries(this.machine.bays.flatMap((bay, lane) => {
      const truck = this.machine.rules.front(lane);
      if (!truck) return [];
      const facing = this.machine.facing(lane);
      const at = this.view.toScreen(bay.x, DECK_TOP + 0.4, this.machine.mouthZ(lane) - facing * (TRUCK.bedLength + TRUCK.cabLength) / 2);
      const color = truck.segments[0]?.color;
      const finalColor = this.board.lanes[lane]?.[truck.index]?.segments.at(-1)?.color;
      return [[`lane${lane}`, { ...at, label: `Truck ${lane + 1}: ${color ? marbleName(color) : ''} at the loop end. Finish with ${finalColor ? marbleName(finalColor) : ''}${truck.unloading.length ? (this.machine.rules.free === 0 ? '. Unloading paused: loop full' : '. Unloading') : ''}` }]];
    }));
  }
  inspect() {
    const rules = this.machine.rules;
    return { occupancy: rules.occupancy, pending: rules.pending, status: rules.status,
      lanes: this.board.lanes.map((_, lane) => rules.front(lane)?.segments.map((segment) => `${segment.color}:${segment.marbles.length}`) ?? null),
      unloading: this.board.lanes.map((_, lane) => {
        const truck = rules.front(lane);
        return truck?.unloading.length ? (rules.free === 0 ? 'waiting' : 'pouring') : null;
      }),
      finalColors: this.board.lanes.map((_, lane) => {
        const truck = rules.front(lane);
        return truck ? this.board.lanes[lane]?.[truck.index]?.segments.at(-1)?.color : null;
      }),
      wants: this.board.lanes.map((_, lane) => rules.wants(lane)), tick: this.machine.tick,
      settling: this.busy || rules.canDrain() };
  }
  dispose() { this.view.dispose(); }
}

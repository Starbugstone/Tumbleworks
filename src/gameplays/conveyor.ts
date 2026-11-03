import { t } from '../i18n';
import type { Feedback, GameRuntime, GameServices } from '../engine/contracts';
import { Machine } from '../machine/machine';
import { CRATE } from '../machine/layout';
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
  get game() { return this.machine; }
  get status() { return this.machine.rules.status; }
  get busy() { return this.machine.transferring; }
  get canUndo() { return this.machine.canUndo; }
  get counter() { return { label: t('Belt', 'Tapis'), value: `${this.machine.rules.occupancy}/${this.board.beltCapacity}${this.machine.rules.funnelCount ? ` +${this.machine.rules.funnelCount}` : ''}`, full: this.machine.rules.free <= 0 }; }
  readonly preview = [];
  readonly previewLabel = '';
  get jamReason() {
    const wanted = this.board.docks.map((_, dock) => this.machine.rules.dockColor(dock)).filter((color) => color !== null);
    const names = [...new Set(wanted)].map((color) => marbleName(color).toLowerCase());
    return t(`The belt is full and the docks only want ${names.join(' or ') || 'nothing more'}. Undo a pour to keep a route open.`, `Le tapis est plein et les quais ne prennent que ${names.join(' ou ') || 'plus rien'}. Annulez un versement pour libérer le passage.`);
  }

  activate(target: string): readonly Feedback[] {
    if (!/^supply\d+$/.test(target) || this.status !== 'playing') return [];
    const result = this.machine.tap(Number(target.slice(6)));
    return result.ok ? [{ type: 'move' }] : [{ type: 'tap' }];
  }
  step(): readonly Feedback[] {
    const feedback: Feedback[] = [];
    const events = this.machine.step();
    this.view.react(events);
    for (const event of events) {
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
      return [{ type: 'message', text: this.machine.rules.canDrain() ? t('Wait: the belt is still draining.', 'Patientez : les boîtes se remplissent encore.') : t('No verified pour from here. Try undoing a pour.', 'Aucun versement sûr trouvé. Essayez d’annuler un versement.') }];
    }
    const color = this.machine.rules.packet(supply)?.color;
    const pair = this.machine.rules.releaseIds(supply).length > 1;
    return [{ type: 'message', text: pair ? t('Tip the joined crates together.', 'Videz les caisses reliées ensemble.') : t(`Tip the ${color ? marbleName(color).toLowerCase() : ''} crate.`, `Videz la caisse ${color ? marbleName(color).toLowerCase() : ''}.`), target: `supply${supply}` }];
  }
  undo(): boolean {
    if (!this.machine.undo()) return false;
    this.view.syncAfterJump();
    return true;
  }
  targets() {
    const actions = this.machine.rules.crateActions
      ? this.machine.readCrates().filter((crate) => crate.visible && !this.machine.rules.state.released.includes(crate.id)).map((crate) => crate.action)
      : this.machine.rules.actions();
    return Object.fromEntries(actions.flatMap((action) => {
      const at = this.machine.frontCrate(action);
      if (!at) return [];
      const color = this.machine.rules.packet(action)?.color;
      return [[`supply${action}`, { ...this.view.toScreen(at.x, at.y + 0.4, at.z + CRATE.halfDepth * 0.65), label: color ? marbleName(color) : '' }]];
    }));
  }

  get guideId() { return this.board.id === 'board-1' ? 'funnel-basics' : undefined; }
  guide() {
    const remaining = this.machine.rules.state.supplies[0]?.length ?? 0;
    if (remaining === 2) return { target: 'supply0', text: t('Tap here to tip a crate into the funnel.', 'Touchez ici pour vider une caisse dans l’entonnoir.') };
    if (remaining === 1) return { target: 'supply0', text: t('Now pour the red ring crate. The front boxes need red.', 'Versez maintenant la caisse rouge à anneau. Les premières boîtes attendent du rouge.') };
    const filled = this.machine.readBoxes().some((box) => box.index === 0 && (box.fill === this.board.boxSize || !box.docked));
    return { text: t('Watch the boxes collect their colour. Then match the remaining boxes.', 'Les boîtes prennent leur couleur au passage. Continuez avec les boîtes restantes.'), done: filled };
  }
  inspect() {
    const rules = this.machine.rules;
    return { occupancy: rules.occupancy, funnel: rules.funnelCount, pending: [...rules.state.pending], released: [...rules.state.released], sealsOpen: [...rules.state.sealsOpen],
      supplies: rules.state.supplies.map((supply) => supply.map((packet) => packet.color)),
      docks: this.board.docks.map((_, dock) => rules.dockColor(dock)),
      recoveries: this.machine.recoveries, tick: this.machine.tick,
      settling: this.busy || rules.canDrain() };
  }
  dispose() { this.view.dispose(); this.machine.world.free(); }
}

import { t } from '../i18n';
import type { Feedback, GameRuntime, GameServices } from '../engine/contracts';
import { Machine } from '../machine/machine';
import { hintConveyor } from '../sim/solver';
import { columnTap } from '../sim/shelf-marks';
import type { MachineRules } from '../sim/rules';
import type { BoardDef } from '../sim/types';
import { marbleName } from '../view/art';
import { MachineScene } from '../view/scene';

/** The jam card's explanation; a covered dock names the box it waits for. */
export function funnelJamReason(rules: MachineRules): string {
  const wanted = rules.board.docks.map((_, dock) => rules.dockColor(dock)).filter((color) => color !== null);
  const names = [...new Set(wanted)].map((color) => marbleName(color).toLowerCase());
  // A covered dock wants nothing yet; say what it waits for, or the full belt looks unfair.
  const covered = (rules.board.seals ?? []).find((seal) => !rules.dockOpen(seal.dock));
  if (covered) {
    const key = marbleName(rules.board.docks[covered.after.dock]![covered.after.box]!).toLowerCase();
    return t(`The belt is full: open docks only want ${names.join(' or ') || 'nothing more'}, and the covered dock waits for the ${key} box. Undo a pour to keep a route open.`,
      `Le tapis est plein : les quais ouverts ne prennent que ${names.join(' ou ') || 'plus rien'}, et le quai couvert attend la boîte ${key}. Annulez un versement pour libérer le passage.`);
  }
  return t(`The belt is full and the docks only want ${names.join(' or ') || 'nothing more'}. Undo a pour to keep a route open.`, `Le tapis est plein et les quais ne prennent que ${names.join(' ou ') || 'plus rien'}. Annulez un versement pour libérer le passage.`);
}

/** Funnel Sort: tip crates into the funnel; the belt never stops; fill every dock's boxes in order. */
export class ConveyorRuntime implements GameRuntime {
  readonly machine: Machine;
  private readonly view: MachineScene;

  constructor(readonly board: BoardDef, services: GameServices) {
    this.machine = new Machine(board, services.physics);
    this.view = new MachineScene(services.stage);
    this.view.setMachine(this.machine);
  }
  get game() { return this.machine; }
  celebrate(clean = 1): void { this.view.celebrate(clean); }
  get status() { return this.machine.rules.status; }
  get busy() { return this.machine.transferring; }
  get canUndo() { return this.machine.canUndo; }
  get counter() { return { label: t('Belt', 'Tapis'), value: `${this.machine.rules.occupancy}/${this.board.beltCapacity}${this.machine.rules.funnelCount ? ` +${this.machine.rules.funnelCount}` : ''}`, full: this.machine.rules.free <= 0 }; }
  readonly preview = [];
  readonly previewLabel = '';
  get jamReason() { return funnelJamReason(this.machine.rules); }

  activate(target: string): readonly Feedback[] {
    if (!/^supply\d+$/.test(target) || this.status !== 'playing') return [];
    const tapped = Number(target.slice(6));
    const action = columnTap(this.machine.rules, tapped);
    const result = this.machine.tap(action);
    if (result.ok) return [{ type: 'move' }];
    // A padlocked shelf crate answers with its own shake and strap flash; words stay out of the way.
    this.view.refuse(tapped);
    return [{ type: 'blocked' }];
  }
  step(): readonly Feedback[] {
    const feedback: Feedback[] = [];
    const events = this.machine.step();
    this.view.react(events);
    for (const event of events) {
      switch (event.type) {
        case 'impact': feedback.push({ type: 'impact', strength: event.strength }); break;
        case 'captured':
          feedback.push({ type: 'landing', arrival: event.fill });
          break;
        default: break;
      }
    }
    this.view.afterTick();
    return feedback;
  }
  render(alpha: number, seconds: number): void { this.view.render(alpha, seconds); }
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
      // Paired boards name only front crates: a back crate's tap pours the front one, so its label would name the wrong crate.
      ? this.machine.readCrates().filter((crate) => crate.visible && !this.machine.rules.state.released.includes(crate.id) && columnTap(this.machine.rules, crate.id) === crate.id).map((crate) => crate.action)
      : this.machine.rules.actions();
    return Object.fromEntries(actions.flatMap((action) => {
      const at = this.machine.frontCrate(action);
      if (!at) return [];
      const color = this.machine.rules.packet(action)?.color;
      const name = color ? marbleName(color) : '';
      // Screen readers and keyboards name the column on classic boards and the crate where crates have their own actions.
      const label = this.machine.rules.crateActions ? t(`Crate ${action + 1}: ${name}`, `Caisse ${action + 1} : ${name}`) : t(`Column ${action + 1}: ${name}`, `Colonne ${action + 1} : ${name}`);
      return [[`supply${action}`, { ...this.view.toScreen(at.x, at.y + 0.4, at.z), label }]];
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

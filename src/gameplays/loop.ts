import { t } from '../i18n';
import type { Feedback, GameRuntime, GameServices } from '../engine/contracts';
import { DECK_TOP, TRUCK } from '../loop/layout';
import { LoopMachine, type TruckLoad } from '../loop/machine';
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
  get game() { return this.machine; }
  get status() { return this.machine.rules.status; }
  get busy() { return this.machine.transferring; }
  get canUndo() { return this.machine.canUndo; }
  get counter() {
    return { label: t('Loop', 'Circuit'), value: `${this.machine.rules.occupancy}/${this.board.loopCapacity}`, full: this.machine.rules.free <= 0 };
  }
  readonly preview = [];
  readonly previewLabel = '';
  get jamReason() {
    const wanted = [...new Set(this.board.lanes.map((_, lane) => this.machine.rules.wants(lane)).filter((want): want is Exclude<typeof want, null | 'any'> => want !== null && want !== 'any'))];
    const names = wanted.map((color) => marbleName(color).toLowerCase());
    if (this.machine.rules.free > 0) return t(`No truck can pour and the trucks only take ${names.join(' or ') || 'nothing right now'}. What they need is stuck in a truck behind. Undo a pour.`, `Aucun camion ne peut se vider et les camions ne prennent que ${names.join(' ou ') || 'plus rien pour le moment'}. Ce qu’il leur faut est bloqué dans un camion derrière. Annulez un versement.`);
    return t(`The loop is full and the trucks only take ${names.join(' or ') || 'nothing right now'}. Undo a pour to free the line.`, `Le circuit est plein et les camions ne prennent que ${names.join(' ou ') || 'plus rien pour le moment'}. Annulez un versement pour libérer le passage.`);
  }

  activate(target: string): readonly Feedback[] {
    const more = /^more(\d+)$/.exec(target);
    if (more) { this.view.togglePeek(Number(more[1])); return []; }
    this.view.closePeek();
    // A waiting lorry cannot be tapped. Answer with the sound and a ring round the one that can, not with words.
    const waiting = /^waiting(\d+)$/.exec(target);
    if (waiting) return this.status === 'playing' && this.machine.rules.front(Number(waiting[1])) ? [{ type: 'blocked', target: `lane${waiting[1]}` }] : [];
    if (!/^lane\d+$/.test(target) || this.status !== 'playing') return [];
    const result = this.machine.tap(Number(target.slice(4)));
    if (result.ok) return [{ type: 'move' }];
    if (result.reason === 'single') return [{ type: 'blocked', text: t('That truck is one color: it only needs to fill up.', 'Ce camion n’a qu’une couleur : il lui reste à se remplir.') }];
    if (result.reason === 'busy') return [{ type: 'tap', text: this.machine.rules.free <= 0 ? t('The loop is full: a truck has to take some before more can pour.', 'Le circuit est plein : un camion doit prendre des billes pour libérer de la place.') : t('Still pouring.', 'Déchargement en cours.') }];
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
    const picked = this.view.pick(x, y);
    if (!picked) return null;
    return `${picked.kind === 'now' ? 'lane' : picked.kind}${picked.lane}`;
  }
  hint(): readonly Feedback[] {
    if (this.status !== 'playing') return [];
    const lane = hintLoop(this.machine.rules);
    if (lane === null) {
      return [{ type: 'message', text: this.machine.rules.canDrain() ? t('Wait: the loop is still unloading into the trucks.', 'Patientez : les camions se remplissent encore.') : t('No verified pour from here. Try undoing a pour.', 'Aucun versement sûr trouvé. Essayez d’annuler un versement.') }];
    }
    const color = this.machine.rules.front(lane)?.segments[0]?.color;
    return [{ type: 'message', text: t(`Pour the ${color ? marbleName(color).toLowerCase() : ''} out of truck ${lane + 1}.`, `Déchargez le ${color ? marbleName(color).toLowerCase() : ''} du camion ${lane + 1}.`), target: `lane${lane}` }];
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
      const trucks = this.machine.readTrucks();
      const docked = trucks.find((candidate) => candidate.lane === lane && candidate.index === truck.index);
      const load = docked ? t(`. Load: ${this.describeLoad(this.machine.loadOf(docked.blocks))}`, `. Chargement : ${this.describeLoad(this.machine.loadOf(docked.blocks))}`) : '';
      const next = this.queue(lane)[0];
      const coming = next ? t(`. Next truck finishes with ${marbleName(next.finalColor)}: ${this.describeLoad(this.machine.loadOf(next.blocks))}`, `. Le camion suivant termine avec ${marbleName(next.finalColor)} : ${this.describeLoad(this.machine.loadOf(next.blocks))}`) : '';
      const unloading = truck.unloading.length ? (this.machine.rules.free === 0 ? t('. Unloading paused: loop full', '. Déchargement en pause : circuit plein') : t('. Unloading', '. Déchargement')) : '';
      return [[`lane${lane}`, { ...at, label: t(`Truck ${lane + 1}: ${color ? marbleName(color) : ''} at the loop end. Finish with ${finalColor ? marbleName(finalColor) : ''}`, `Camion ${lane + 1} : ${color ? marbleName(color) : ''} au bout de la benne. Terminer avec ${finalColor ? marbleName(finalColor) : ''}`) + load + coming + unloading }]];
    }));
  }
  /** A truck's load in words, for the screen-reader labels of the board controls. */
  private describeLoad(load: TruckLoad): string {
    const shares = load.shares.map((share) => t(`${marbleName(share.color)} ${share.percent}%`, `${marbleName(share.color)} ${share.percent} %`));
    return [...shares, t(`${load.freePercent}% free`, `${load.freePercent} % libre`)].join(', ');
  }
  /** Every truck still in a lane's line, the next one first. */
  private queue(lane: number) {
    return this.machine.readTrucks().filter((truck) => truck.lane === lane && truck.queueSlot !== null).sort((a, b) => a.queueSlot! - b.queueSlot!);
  }
  get guideId() { return this.board.id === 'loop-1' ? 'loop-basics' : undefined; }
  guide() {
    const first = this.machine.rules.front(0);
    const second = this.machine.rules.front(1);
    if (first && first.segments.length > 1 && !first.unloading.length) return { target: 'lane0', text: t('This cab needs blue diamonds. Tap to unload the red at the open end.', 'Cette cabine demande du bleu à losange. Touchez pour décharger le rouge au bout de la benne.') };
    if (second && second.segments.length > 1 && !second.unloading.length) return { target: 'lane1', text: t('Tap this truck too. It needs red rings, so send its blue onto the belt.', 'Touchez aussi ce camion. Il veut du rouge à anneau : envoyez son bleu sur le tapis.') };
    return { done: !first || !second, text: t('The trucks collect matching marbles automatically. A full truck leaves!', 'Les camions prennent automatiquement leur couleur. Une fois plein, le camion part !') };
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
      loads: this.board.lanes.map((_, lane) => {
        const truck = rules.front(lane);
        const docked = truck && this.machine.readTrucks().find((candidate) => candidate.lane === lane && candidate.index === truck.index);
        return docked ? this.machine.loadOf(docked.blocks) : null;
      }),
      queues: this.board.lanes.map((_, lane) => this.queue(lane).map((truck) => ({ finalColor: truck.finalColor, ...this.machine.loadOf(truck.blocks) }))),
      queueBounds: this.view.waitingBounds(), printedNumbers: this.view.printedNumbers(), dockedCardHeight: this.view.dockedCardHeight(),
      settling: this.busy || rules.canDrain() };
  }
  dispose() { this.view.dispose(); }
}

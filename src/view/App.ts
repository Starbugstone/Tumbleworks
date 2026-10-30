import { sfx } from '../audio';
import { initPhysics, Machine, type MachineEvent } from '../machine/machine';
import { RACEWAY, supplyX, TICK_SECONDS, TRAY } from '../machine/layout';
import { isCompleted, markCompleted } from '../progress';
import { BOARDS } from '../sim/boards';
import type { ReleaseResult } from '../sim/rules';
import type { Color } from '../sim/types';
import { COLOR_NAMES, COLORS, drawSymbol } from './art';
import { MachineScene } from './scene';

const MAX_FRAME_SECONDS = 0.25;
const MAX_STEPS_PER_FRAME = 8;
const QUALITY_CHECK_SECONDS = 2.5;
const SLOW_FRAME_SECONDS = 1 / 30;

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found as T;
};

export class App {
  readonly scene: MachineScene;
  machine!: Machine;
  boardIndex = 0;

  private accumulator = 0;
  private lastFrame = performance.now();
  /** Set by the capture script, which advances the game one frame at a time. */
  manualClock = false;
  private jamExplained = false;
  private guided = false;
  private guideSeen = false;
  private messageTimer = 0;
  private chain = 0;
  private slowClock = 0;
  private slowFrames = 0;

  private readonly load = element('load');
  private readonly message = element('message');
  private readonly undoButton = element<HTMLButtonElement>('undo');
  private readonly arrow = element('arrow');
  private readonly card = element('card');
  private readonly cardTitle = element('card-title');
  private readonly cardBody = element('card-body');
  private readonly cardAction = element<HTMLButtonElement>('card-action');
  private readonly nextBoxes = element('next-boxes');
  private readonly chips = element('chips');
  private readonly flash = element('flash');
  private readonly confetti = element('confetti');

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new MachineScene(canvas);

    canvas.addEventListener('pointerdown', (event) => {
      sfx.unlock();
      const supply = this.scene.pick(event.clientX, event.clientY);
      if (supply !== null) this.onSupplyTap(supply);
    });
    this.undoButton.addEventListener('click', () => this.onUndo());
    element('restart').addEventListener('click', () => this.onRestart());
    this.cardAction.addEventListener('click', () => this.onCardAction());
    const mute = element('mute');
    mute.classList.toggle('muted', sfx.isMuted);
    mute.addEventListener('click', () => {
      sfx.unlock();
      mute.classList.toggle('muted', sfx.toggleMute());
    });
    window.addEventListener('resize', () => {
      this.scene.resize();
      this.placeOverlays();
    });
  }

  static async start(canvas: HTMLCanvasElement): Promise<App> {
    await initPhysics();
    const app = new App(canvas);
    const firstOpen = BOARDS.findIndex((board) => !isCompleted(board.id));
    app.loadBoard(firstOpen === -1 ? BOARDS.length - 1 : firstOpen);
    requestAnimationFrame(app.frame);
    return app;
  }

  private loadBoard(index: number): void {
    const board = BOARDS[index];
    if (!board) throw new Error(`No board at index ${index}`);
    if (this.machine) this.machine.world.free();
    this.boardIndex = index;
    this.machine = new Machine(board);
    this.scene.setMachine(this.machine);
    this.accumulator = 0;
    this.jamExplained = false;
    this.chain = 0;
    this.hideCard();
    this.setMessage('');
    this.confetti.replaceChildren();
    this.guided = index === 0 && !isCompleted(board.id) && !this.guideSeen;
    if (this.guided) this.showGuide();
    else this.arrow.hidden = true;
    this.renderChips();
    this.refresh();
  }

  private readonly frame = (now: number): void => {
    const seconds = Math.min((now - this.lastFrame) / 1000, MAX_FRAME_SECONDS);
    this.lastFrame = now;
    if (!this.manualClock) {
      this.advance(seconds);
      this.watchFrameTime(seconds);
    }
    requestAnimationFrame(this.frame);
  };

  /** Steps the graphics down on a device that can't hold a smooth frame rate. Physics is never touched. */
  private watchFrameTime(seconds: number): void {
    this.slowClock += seconds;
    this.slowFrames += 1;
    if (this.slowClock < QUALITY_CHECK_SECONDS) return;
    const average = this.slowClock / this.slowFrames;
    this.slowClock = 0;
    this.slowFrames = 0;
    if (average > SLOW_FRAME_SECONDS) this.scene.lowerQuality();
  }

  /** Runs the physics for this much real time, then draws. */
  advance(seconds: number, draw = true): void {
    this.accumulator += seconds;
    let steps = 0;
    while (this.accumulator >= TICK_SECONDS && steps < MAX_STEPS_PER_FRAME) {
      this.accumulator -= TICK_SECONDS;
      steps += 1;
      this.handleEvents(this.machine.step());
      this.scene.afterTick();
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    if (draw) this.scene.render(this.accumulator / TICK_SECONDS, seconds);
    this.refresh();
  }

  private handleEvents(events: readonly MachineEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'impact':
          sfx.impact(event.strength);
          break;
        case 'kick':
          sfx.kick();
          break;
        case 'captured':
          sfx.deliver(event.fill - 1);
          this.vibrate(10);
          break;
        case 'boxFull':
          sfx.boxFilled(this.chain);
          this.chain += 1;
          this.vibrate(20);
          break;
        case 'won':
          markCompleted(this.machine.board.id);
          this.renderChips();
          sfx.win();
          this.vibrate(50);
          this.showWin();
          break;
        case 'jammed':
          sfx.jam();
          this.vibrate(70);
          break;
        case 'boxSwapped':
        case 'recovered':
          break;
      }
    }
    const { rules } = this.machine;
    if (rules.status === 'jammed' && !this.jamExplained) {
      const pouring = rules.state.marbles.some((marble) => marble.status === 'pouring');
      if (!pouring) {
        this.jamExplained = true;
        this.showJam();
      }
    }
  }

  // ---- Input ----

  private onSupplyTap(supply: number): void {
    const { rules } = this.machine;
    if (rules.status !== 'playing') return;
    if (this.guided && supply !== 0) {
      sfx.tap();
      this.arrow.classList.remove('nudge');
      void this.arrow.offsetWidth;
      this.arrow.classList.add('nudge');
      return;
    }
    const result: ReleaseResult = this.machine.tap(supply);
    if (!result.ok) {
      if (result.reason === 'no-space') {
        if (result.canDrain) {
          sfx.tap();
          this.setMessage(`Needs ${result.needed} free spaces. The belt is clearing.`, 1700);
        } else {
          sfx.blocked();
          this.vibrate(30);
          this.setMessage(`Needs ${result.needed} free spaces.`, 1800, true);
        }
      } else if (result.reason === 'empty') {
        sfx.tap();
      }
      return;
    }
    sfx.release();
    this.vibrate(12);
    if (this.guided) {
      this.guided = false;
      this.guideSeen = true;
      this.arrow.hidden = true;
      this.setMessage(`${COLOR_NAMES[result.color]} keeps riding until a ${result.color} box is ready.`, 5000);
    } else {
      this.setMessage('');
    }
    this.refresh();
  }

  private onUndo(): void {
    sfx.unlock();
    if (!this.machine.undo()) return;
    sfx.undo();
    this.scene.syncAfterJump();
    this.jamExplained = false;
    this.chain = 0;
    this.hideCard();
    this.setMessage('');
    this.flashScreen();
    this.refresh();
  }

  private onRestart(): void {
    sfx.unlock();
    sfx.undo();
    this.flashScreen();
    this.loadBoard(this.boardIndex);
  }

  private onCardAction(): void {
    if (this.machine.rules.status === 'won') {
      this.loadBoard(this.boardIndex + 1 < BOARDS.length ? this.boardIndex + 1 : 0);
    } else {
      this.hideCard();
    }
  }

  // ---- Overlays ----

  private refresh(): void {
    const { rules, board } = this.machine;
    const loadText = `${rules.occupancy} / ${board.beltCapacity}`;
    if (this.load.textContent !== loadText) this.load.textContent = loadText;
    this.load.classList.toggle('jammed', rules.status === 'jammed');
    this.undoButton.disabled = !this.machine.canUndo;
    this.undoButton.classList.toggle('attention', rules.status === 'jammed');
    this.renderNextBoxes();
    this.placeOverlays();
  }

  private placeOverlays(): void {
    const center = this.scene.toScreen(0, RACEWAY.floorY + 0.7, RACEWAY.centerZ + 0.62);
    this.load.style.transform = `translate(${center.x}px, ${center.y}px) translate(-50%, -50%)`;
    if (!this.arrow.hidden) {
      const count = this.machine.board.supplies.length;
      const spot = this.scene.toScreen(supplyX(0, count) - TRAY.halfWidth - 0.8, TRAY.frontY + 0.3, TRAY.frontZ - 1.2);
      this.arrow.style.left = `${spot.x}px`;
      this.arrow.style.top = `${spot.y}px`;
    }
  }

  private nextBoxesKey = '';

  private renderNextBoxes(): void {
    const { board } = this.machine;
    const upcoming = board.boxes.slice(this.machine.activeBoxForView + 1);
    const key = upcoming.join();
    if (key === this.nextBoxesKey) return;
    this.nextBoxesKey = key;
    this.nextBoxes.replaceChildren(...upcoming.map((color) => this.boxChip(color)));
  }

  private boxChip(color: Color): HTMLCanvasElement {
    const chip = document.createElement('canvas');
    chip.width = 64;
    chip.height = 64;
    chip.className = 'box-chip';
    chip.style.backgroundColor = COLORS[color].base;
    const ctx = chip.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      drawSymbol(ctx, color, 32, 33, 18);
    }
    return chip;
  }

  private renderChips(): void {
    this.chips.replaceChildren(
      ...BOARDS.map((board, index) => {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.dataset['level'] = String(index);
        chip.classList.toggle('active', index === this.boardIndex);
        const previous = BOARDS[index - 1];
        const locked = previous !== undefined && !isCompleted(previous.id) && index !== this.boardIndex;
        chip.disabled = locked;
        chip.textContent = isCompleted(board.id) ? '✓' : String(index + 1);
        chip.addEventListener('click', () => {
          sfx.unlock();
          if (index !== this.boardIndex) this.loadBoard(index);
        });
        return chip;
      }),
    );
  }

  private setMessage(value: string, holdMs = 0, alarm = false): void {
    window.clearTimeout(this.messageTimer);
    this.message.textContent = value;
    this.message.hidden = value === '';
    this.message.classList.toggle('alarm', alarm);
    if (holdMs > 0) this.messageTimer = window.setTimeout(() => this.setMessage(''), holdMs);
  }

  private showGuide(): void {
    const front = this.machine.rules.state.supplies[0]?.[0];
    if (!front) return;
    this.arrow.hidden = false;
    this.setMessage(`Tap ${front.color} to tip it out and uncover what's underneath.`);
  }

  private showCard(title: string, body: string, action: string, kind: 'jam' | 'win'): void {
    this.cardTitle.textContent = title;
    this.cardBody.textContent = body;
    this.cardAction.textContent = action;
    this.card.dataset['kind'] = kind;
    this.card.hidden = false;
  }

  private hideCard(): void {
    this.card.hidden = true;
  }

  private showJam(): void {
    this.setMessage('');
    const { rules } = this.machine;
    const color = rules.activeColor;
    const name = color ?? 'the next colour';
    const exposed = rules.state.supplies.some((queue) => queue[0]?.color === color);
    const reason = exposed
      ? `The next box needs ${name}, but there's no room left on the belt to release it.`
      : `The next box needs ${name}, but it's stuck under another packet, with no room to move that packet.`;
    this.showCard('Belt jammed!', reason, 'Keep looking', 'jam');
  }

  private showWin(): void {
    const hasNext = this.boardIndex + 1 < BOARDS.length;
    this.launchConfetti();
    window.setTimeout(() => {
      if (this.machine.rules.status !== 'won') return;
      this.showCard(
        hasNext ? 'Machine clear!' : 'All clear!',
        hasNext ? 'Every box filled.' : "That's the whole demo so far.",
        hasNext ? 'Next level' : 'Play again',
        'win',
      );
    }, 600);
  }

  private launchConfetti(): void {
    const palette = Object.values(COLORS).map((color) => color.base);
    const pieces: HTMLElement[] = [];
    for (let i = 0; i < 90; i++) {
      const piece = document.createElement('i');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = palette[i % palette.length] ?? '#fff';
      piece.style.animationDelay = `${Math.random() * 0.5}s`;
      piece.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      pieces.push(piece);
    }
    this.confetti.replaceChildren(...pieces);
  }

  private flashScreen(): void {
    this.flash.classList.remove('go');
    void this.flash.offsetWidth;
    this.flash.classList.add('go');
  }

  private vibrate(ms: number): void {
    if ('vibrate' in navigator) navigator.vibrate(ms);
  }

  // ---- Test and capture hooks ----

  /** Positions in page CSS pixels, so a browser test can tap what a player would. */
  debugTargets(): Record<string, { x: number; y: number }> {
    const count = this.machine.board.supplies.length;
    const targets: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < count; i++) {
      targets[`supply${i}`] = this.scene.toScreen(supplyX(i, count), TRAY.frontY + 0.4, TRAY.frontZ - 1.2);
    }
    const center = (id: string): { x: number; y: number } => {
      const rect = element(id).getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    targets['undo'] = center('undo');
    targets['restart'] = center('restart');
    targets['card'] = center('card-action');
    return targets;
  }
}

import { sfx } from '../audio';
import { CAMPAIGN } from '../campaign';
import type { Feedback, GameRuntime, GameServices, ScreenPoint } from '../engine/contracts';
import { FIXED_SECONDS, physics } from '../engine/physics';
import { Stage } from '../engine/stage';
import { currentLevel, isCompleted, markCompleted, selectLevel } from '../progress';
import { COLORS, drawSymbol } from './art';
import type { Color } from '../sim/types';

const element = (id: string): HTMLElement => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing #${id}`);
  return found;
};
const button = (id: string): HTMLButtonElement => {
  const found = element(id);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`#${id} must be a button`);
  return found;
};

/** Campaign, controls and feedback only. Gameplay rules and entities belong to registered runtimes. */
export class App {
  readonly stage: Stage;
  readonly services: GameServices;
  runtime!: GameRuntime;
  boardIndex = 0;
  manualClock = false;
  private accumulator = 0;
  private lastFrame = performance.now();
  private slowTime = 0;
  private slowFrames = 0;
  private ending: 'none' | 'won' | 'jammed' = 'none';
  private messageTimer = 0;
  private winTimer = 0;
  private hintTimer = 0;
  private previewKey = '';
  private targetKey = '';
  private focusTarget: string | null = null;
  private chain = 0;
  private readonly message = element('message');
  private readonly undoButton = button('undo');
  private readonly card = element('card');
  private readonly chips = element('chips');
  private readonly ring = element('focus-ring');

  constructor(canvas: HTMLCanvasElement) {
    this.stage = new Stage(canvas);
    this.services = { stage: this.stage, physics };
    canvas.addEventListener('pointerdown', (event) => {
      sfx.unlock();
      const target = this.runtime.pick(event.clientX, event.clientY);
      if (target) this.activate(target);
    });
    this.undoButton.addEventListener('click', () => this.undo());
    button('restart').addEventListener('click', () => { sfx.unlock(); this.loadBoard(this.boardIndex); });
    button('hint').addEventListener('click', () => { sfx.unlock(); this.feedback(this.runtime.hint()); this.refresh(); });
    button('card-action').addEventListener('click', () => {
      sfx.unlock();
      if (this.runtime.status === 'won') this.loadBoard((this.boardIndex + 1) % CAMPAIGN.length);
      else this.card.hidden = true;
    });
    const mute = button('mute');
    mute.classList.toggle('muted', sfx.isMuted);
    mute.addEventListener('click', () => {
      sfx.unlock();
      mute.classList.toggle('muted', sfx.toggleMute());
      mute.setAttribute('aria-pressed', String(sfx.isMuted));
    });
    window.addEventListener('resize', () => { this.runtime?.resize(); this.refresh(); });
    document.addEventListener('visibilitychange', () => { this.lastFrame = performance.now(); this.accumulator = 0; });
    document.addEventListener('keydown', (event) => this.key(event));
  }

  static async start(canvas: HTMLCanvasElement): Promise<App> {
    await physics.init();
    const app = new App(canvas);
    const saved = currentLevel();
    const selected = CAMPAIGN.findIndex((level) => level.id === saved && !isCompleted(level.id));
    const open = CAMPAIGN.findIndex((level) => !isCompleted(level.id));
    app.loadBoard(selected >= 0 ? selected : Math.max(0, open));
    element('boot').hidden = true;
    requestAnimationFrame(app.frame);
    return app;
  }

  private loadBoard(index: number): void {
    const level = CAMPAIGN[index];
    if (!level) throw new Error(`No campaign level ${index}`);
    window.clearTimeout(this.winTimer);
    window.clearTimeout(this.hintTimer);
    this.runtime?.dispose();
    this.boardIndex = index;
    this.runtime = level.create(this.services);
    selectLevel(level.id);
    this.accumulator = 0;
    this.lastFrame = performance.now();
    this.ending = 'none';
    this.chain = 0;
    this.previewKey = '';
    this.targetKey = '';
    this.focusTarget = null;
    this.ring.hidden = true;
    this.card.hidden = true;
    this.setMessage('');
    element('confetti').replaceChildren();
    element('level-name').textContent = `${index + 1} / ${CAMPAIGN.length} · ${level.name}`;
    element('level-title').textContent = level.title;
    element('difficulty').textContent = level.difficulty;
    element('instruction').textContent = level.instructions;
    this.renderChips();
    this.runtime.resize();
    this.runtime.render(0, 0);
    this.refresh();
  }

  private readonly frame = (now: number): void => {
    const seconds = Math.min(Math.max((now - this.lastFrame) / 1000, 0), 0.25);
    this.lastFrame = now;
    if (!this.manualClock && !document.hidden) {
      this.advance(seconds);
      this.slowTime += seconds;
      this.slowFrames++;
      if (this.slowTime >= 2.5) {
        if (this.slowTime / this.slowFrames > 1 / 30) this.stage.lowerQuality();
        this.slowTime = 0;
        this.slowFrames = 0;
      }
    }
    requestAnimationFrame(this.frame);
  };

  advance(seconds: number, draw = true): void {
    this.accumulator += Math.min(seconds, 0.25);
    let steps = 0;
    while (this.accumulator >= FIXED_SECONDS && steps < 8) {
      this.accumulator -= FIXED_SECONDS;
      this.feedback(this.runtime.step());
      steps++;
    }
    if (steps === 8) this.accumulator = 0;
    if (draw) this.runtime.render(this.accumulator / FIXED_SECONDS, seconds);
    this.checkEnding();
    this.refresh();
  }

  private activate(target: string, keepFocus = false): void {
    this.ring.hidden = !keepFocus;
    this.focusTarget = keepFocus ? target : null;
    this.setMessage('');
    this.feedback(this.runtime.activate(target));
    this.checkEnding();
    this.refresh();
  }

  private feedback(events: readonly Feedback[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'tap': sfx.tap(); break;
        case 'move': sfx.tap(); break;
        case 'match': sfx.boxFilled(this.chain++); break;
        case 'blocked': sfx.blocked(); break;
        case 'impact': sfx.impact(event.strength ?? 0.2); break;
        case 'deliver': sfx.deliver(event.slot ?? 0); break;
        case 'message': break;
      }
      if (event.text) this.setMessage(event.text, 5500, event.type === 'blocked');
      if (event.target) {
        this.focusTarget = event.target;
        this.ring.hidden = false;
        window.clearTimeout(this.hintTimer);
        this.hintTimer = window.setTimeout(() => { this.ring.hidden = true; this.focusTarget = null; }, 6000);
      }
    }
  }

  private undo(): void {
    sfx.unlock();
    if (!this.runtime.undo()) return;
    window.clearTimeout(this.winTimer);
    sfx.undo();
    this.ending = 'none';
    this.chain = 0;
    this.card.hidden = true;
    this.ring.hidden = true;
    this.focusTarget = null;
    this.setMessage('');
    this.runtime.render(0, 0);
    this.refresh();
  }

  private checkEnding(): void {
    if (this.runtime.busy || this.runtime.status === 'playing' || this.ending !== 'none') return;
    this.ending = this.runtime.status;
    if (this.ending === 'won') {
      const level = CAMPAIGN[this.boardIndex];
      if (!level) return;
      markCompleted(level.id);
      sfx.win();
      this.renderChips();
      this.confetti();
      this.winTimer = window.setTimeout(() => {
        if (this.runtime.status !== 'won') return;
        const next = CAMPAIGN[this.boardIndex + 1];
        this.showCard(next ? 'Nicely sorted!' : 'Workshop complete!',
          next ? `Up next: ${next.name.toLowerCase()}.` : 'Every puzzle sorted. Pick a level above to play again.',
          next ? 'Next level' : 'Play again', 'win');
      }, 400);
    } else {
      sfx.jam();
      this.showCard('A little tangled!', this.runtime.jamReason, 'Keep looking', 'jam');
    }
  }

  private refresh(): void {
    const level = CAMPAIGN[this.boardIndex];
    if (!level) return;
    const counter = this.runtime.counter;
    const loadText = `${counter.label} ${counter.value}`;
    if (element('load').textContent !== loadText) element('load').textContent = loadText;
    element('load').classList.toggle('jammed', this.runtime.status === 'jammed');
    this.undoButton.disabled = !this.runtime.canUndo;
    this.undoButton.classList.toggle('attention', this.runtime.status === 'jammed');
    button('hint').disabled = this.runtime.status !== 'playing';
    const key = this.runtime.preview.join(',');
    if (key !== this.previewKey) {
      this.previewKey = key;
      element('next-boxes').replaceChildren(...this.runtime.preview.map((color) => this.boxChip(color)));
    }
    element('next').hidden = this.runtime.preview.length === 0;
    element('next-label').textContent = this.runtime.previewLabel;
    const targets = this.runtime.targets();
    const targetKey = Object.keys(targets).join(',');
    if (targetKey !== this.targetKey) {
      this.targetKey = targetKey;
      element('board-controls').replaceChildren(...Object.entries(targets).map(([id, point]) => {
        const control = document.createElement('button');
        control.textContent = point.label ?? id;
        control.addEventListener('click', () => { sfx.unlock(); this.activate(id); });
        control.addEventListener('focus', () => { this.focusTarget = id; this.ring.hidden = false; });
        return control;
      }));
    }
    const focus = this.focusTarget ? targets[this.focusTarget] : undefined;
    if (focus) {
      this.ring.style.left = `${focus.x}px`;
      this.ring.style.top = `${focus.y}px`;
    } else this.ring.hidden = true;
  }

  private renderChips(): void {
    this.chips.replaceChildren(...CAMPAIGN.map((level, index) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.dataset['level'] = String(index);
      chip.dataset['kind'] = level.kind;
      chip.classList.toggle('active', index === this.boardIndex);
      chip.textContent = isCompleted(level.id) ? '✓' : String(index + 1);
      chip.setAttribute('aria-label', `Level ${index + 1}: ${level.name}, ${level.difficulty}${isCompleted(level.id) ? ', completed' : ''}`);
      chip.setAttribute('aria-current', index === this.boardIndex ? 'step' : 'false');
      chip.addEventListener('click', () => { sfx.unlock(); if (index !== this.boardIndex) this.loadBoard(index); });
      return chip;
    }));
  }

  private boxChip(color: Color): HTMLCanvasElement {
    const chip = document.createElement('canvas');
    chip.width = 64;
    chip.height = 64;
    chip.className = 'box-chip';
    chip.style.backgroundColor = COLORS[color].base;
    chip.setAttribute('aria-label', color);
    const context = chip.getContext('2d');
    if (context) { context.fillStyle = '#fff'; drawSymbol(context, color, 32, 33, 18); }
    return chip;
  }
  private setMessage(text: string, hold = 0, alarm = false): void {
    window.clearTimeout(this.messageTimer);
    this.message.textContent = text;
    this.message.hidden = !text;
    this.message.classList.toggle('alarm', alarm);
    if (hold) this.messageTimer = window.setTimeout(() => this.setMessage(''), hold);
  }
  private showCard(title: string, text: string, action: string, kind: 'win' | 'jam'): void {
    element('card-title').textContent = title;
    element('card-body').textContent = text;
    button('card-action').textContent = action;
    this.card.dataset['kind'] = kind;
    this.card.hidden = false;
  }
  private confetti(): void {
    const palette = Object.values(COLORS);
    element('confetti').replaceChildren(...Array.from({ length: 65 }, (_, index) => {
      const piece = document.createElement('i');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = palette[index % palette.length]?.base ?? '#fff';
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      piece.style.animationDuration = `${1.5 + Math.random()}s`;
      return piece;
    }));
  }
  private key(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' ')) return;
    if (event.key === 'u') this.undo();
    else if (event.key === 'h') this.feedback(this.runtime.hint());
    else if (event.key === 'r') this.loadBoard(this.boardIndex);
    else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      this.stage.canvas.focus({ preventScroll: true });
      const keys = Object.keys(this.runtime.targets());
      const index = this.focusTarget ? keys.indexOf(this.focusTarget) : -1;
      const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      this.focusTarget = keys[(index + delta + keys.length) % keys.length] ?? null;
      this.ring.hidden = false;
    } else if ((event.key === 'Enter' || event.key === ' ') && this.focusTarget) {
      event.preventDefault(); sfx.unlock(); this.activate(this.focusTarget, true);
    }
    this.refresh();
  }
  debugTargets(): Record<string, ScreenPoint> {
    const targets = this.runtime.targets();
    for (const id of ['undo', 'restart', 'hint', 'card-action']) {
      const rect = element(id).getBoundingClientRect();
      targets[id === 'card-action' ? 'card' : id] = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return targets;
  }
  debugState(): Record<string, unknown> {
    const level = CAMPAIGN[this.boardIndex];
    return { levelIndex: this.boardIndex, levelId: level?.id, kind: level?.kind, difficulty: level?.difficulty,
      ...this.runtime.inspect(), status: this.runtime.status, busy: this.runtime.busy, entities: this.stage.marbles.count };
  }
}

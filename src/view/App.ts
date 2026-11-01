import { sfx } from '../audio';
import { CAMPAIGN } from '../campaign';
import type { Feedback, GameRuntime, GameServices, ScreenPoint } from '../engine/contracts';
import { FIXED_SECONDS, physics } from '../engine/physics';
import { Stage } from '../engine/stage';
import { BoardPointer } from '../engine/pointer';
import { currentLevel, isCompleted, markCompleted, selectLevel } from '../progress';
import { COLORS, drawSymbol } from './art';
import type { Color } from '../sim/types';
import { colorName, difficultyName, patternName, t } from '../i18n';
import { guideSeen, locale, onLocaleChange, setGuideSeen, setLocale } from '../preferences';

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
  /** Held fast forward runs this many ticks per real tick: a lap of a full belt in a third of the time. */
  static readonly FAST_SPEED = 3;
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
  private instructionTimer = 0;
  private previewKey = '';
  private targetKey = '';
  private focusTarget: string | null = null;
  private chain = 0;
  private guiding = false;
  /** Simulation speed while the fast-forward button or key is held. Rules are unchanged; ticks just come faster. */
  private speed = 1;
  private readonly message = element('message');
  private readonly undoButton = button('undo');
  private readonly fastButton = button('fast');
  private readonly card = element('card');
  private readonly chips = element('chips');
  private readonly ring = element('focus-ring');
  private readonly pointer: BoardPointer;

  constructor(canvas: HTMLCanvasElement) {
    this.stage = new Stage(canvas);
    this.services = { stage: this.stage, physics };
    this.pointer = new BoardPointer(canvas, {
      unlock: () => sfx.unlock(),
      pick: (point) => this.runtime.pick(point.x, point.y),
      tap: (target) => this.activate(target),
      start: (target, point) => this.runtime.drag?.start(target, point) ?? false,
      move: (point, target) => { this.runtime.drag?.move(point, target); this.runtime.render(0, 0); },
      end: (target) => { this.feedback(this.runtime.drag?.end(target) ?? []); this.runtime.render(0, 0); this.checkEnding(); this.refresh(); },
      cancel: () => { this.runtime.drag?.cancel(); this.runtime.render(0, 0); this.refresh(); },
    });
    this.undoButton.addEventListener('click', () => this.undo());
    button('restart').addEventListener('click', () => { sfx.unlock(); this.loadBoard(this.boardIndex); });
    button('hint').addEventListener('click', () => { sfx.unlock(); this.feedback(this.runtime.hint()); this.refresh(); });
    button('card-action').addEventListener('click', () => {
      sfx.unlock();
      if (this.runtime.status === 'won') this.loadBoard((this.boardIndex + 1) % CAMPAIGN.length);
      else this.card.hidden = true;
    });
    this.bindFastForward();
    const toggle = button('levels-toggle');
    toggle.addEventListener('click', () => { sfx.unlock(); this.showLevels(element('levels').hidden !== false); });
    const mute = button('mute');
    mute.classList.toggle('muted', sfx.isMuted);
    mute.addEventListener('click', () => {
      sfx.unlock();
      mute.classList.toggle('muted', sfx.toggleMute());
      mute.setAttribute('aria-pressed', String(sfx.isMuted));
    });
    window.addEventListener('resize', () => { this.pointer.cancel(); this.runtime?.resize(); this.refresh(); });
    document.addEventListener('visibilitychange', () => { this.pointer.cancel(); this.setFast(false); this.lastFrame = performance.now(); this.accumulator = 0; });
    window.addEventListener('blur', () => this.setFast(false));
    document.addEventListener('keydown', (event) => this.key(event));
    document.addEventListener('keyup', (event) => { if (event.key === 'f' || event.key === 'F') this.setFast(false); });
    button('language-en').addEventListener('click', () => setLocale('en'));
    button('language-fr').addEventListener('click', () => setLocale('fr'));
    button('guide-skip').addEventListener('click', () => this.finishGuide());
    button('guide-replay').addEventListener('click', () => {
      const id = this.runtime.guideId;
      if (!id) return;
      setGuideSeen(id, false);
      this.loadBoard(this.boardIndex);
    });
    onLocaleChange(() => {
      this.pointer.cancel();
      this.setMessage('');
      this.previewKey = '';
      this.localize();
      if (!this.card.hidden) this.endingCard();
      this.refresh();
    });
  }

  /** Press and hold, on any pointer: capture keeps the release even when the finger slides off. */
  private bindFastForward(): void {
    const fast = this.fastButton;
    fast.addEventListener('contextmenu', (event) => event.preventDefault());
    fast.addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });
    fast.addEventListener('pointerdown', (event) => {
      if (fast.disabled) return;
      event.preventDefault();
      sfx.unlock();
      fast.setPointerCapture(event.pointerId);
      this.setFast(true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) fast.addEventListener(type, () => this.setFast(false));
    fast.addEventListener('keydown', (event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); this.setFast(true); } });
    fast.addEventListener('keyup', (event) => { if (event.key === ' ' || event.key === 'Enter') this.setFast(false); });
    fast.addEventListener('blur', () => this.setFast(false));
  }

  get fastForward(): boolean { return this.speed > 1; }

  setFast(on: boolean): void {
    const allowed = on && Boolean(this.runtime) && this.runtime.status === 'playing' && !this.fastButton.disabled;
    const next = allowed ? App.FAST_SPEED : 1;
    if (next === this.speed) return;
    this.speed = next;
    this.fastButton.classList.toggle('active', allowed);
    this.fastButton.setAttribute('aria-pressed', String(allowed));
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
    this.pointer.cancel();
    const level = CAMPAIGN[index];
    if (!level) throw new Error(`No campaign level ${index}`);
    window.clearTimeout(this.winTimer);
    window.clearTimeout(this.hintTimer);
    this.setFast(false);
    this.runtime?.dispose();
    this.boardIndex = index;
    this.runtime = level.create(this.services);
    this.guiding = Boolean(this.runtime.guideId && !guideSeen(this.runtime.guideId));
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
    this.localize();
    element('instruction').hidden = this.guiding;
    window.clearTimeout(this.instructionTimer);
    this.instructionTimer = window.setTimeout(() => { element('instruction').hidden = true; }, 6000);
    this.showLevels(false);
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
    this.accumulator += Math.min(seconds * this.speed, 0.25);
    const limit = 8 * this.speed;
    let steps = 0;
    while (this.accumulator >= FIXED_SECONDS && steps < limit) {
      this.accumulator -= FIXED_SECONDS;
      this.feedback(this.runtime.step());
      steps++;
    }
    if (steps === limit) this.accumulator = 0;
    if (draw) this.runtime.render(this.accumulator / FIXED_SECONDS, seconds);
    this.checkEnding();
    this.refresh();
  }

  private activate(target: string, keepFocus = false): void {
    this.ring.hidden = !keepFocus;
    this.focusTarget = keepFocus ? target : null;
    this.setMessage('');
    element('instruction').hidden = true;
    this.feedback(this.runtime.activate(target));
    this.checkEnding();
    this.refresh();
  }

  private feedback(events: readonly Feedback[]): void {
    // Fast forward triples the event rate, so the small per-marble sounds rest and only the payoffs play.
    const quiet = this.speed > 1;
    for (const event of events) {
      switch (event.type) {
        case 'tap': if (!quiet) sfx.tap(); break;
        case 'move': sfx.release(); break;
        case 'match': sfx.boxFilled(this.chain++); break;
        case 'blocked': sfx.blocked(); break;
        case 'impact': if (!quiet) sfx.impact(event.strength ?? 0.2); break;
        case 'deliver': if (!quiet || (event.slot ?? 0) === 0) sfx.deliver(event.slot ?? 0); break;
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
    this.pointer.cancel();
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
        this.endingCard();
      }, 400);
    } else {
      sfx.jam();
      this.endingCard();
    }
  }

  private refresh(): void {
    const level = CAMPAIGN[this.boardIndex];
    if (!level) return;
    const counter = this.runtime.counter;
    const loadText = `${counter.label} ${counter.value}`;
    if (element('load').textContent !== loadText) element('load').textContent = loadText;
    element('load').classList.toggle('full', Boolean(counter.full) && this.runtime.status === 'playing');
    element('load').classList.toggle('jammed', this.runtime.status === 'jammed');
    this.undoButton.disabled = !this.runtime.canUndo;
    this.undoButton.classList.toggle('attention', this.runtime.status === 'jammed');
    button('hint').disabled = this.runtime.status !== 'playing';
    this.fastButton.disabled = this.runtime.status !== 'playing';
    if (this.fastButton.disabled) this.setFast(false);
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
    Object.entries(targets).forEach(([id, point], index) => {
      const control = element('board-controls').children.item(index);
      const label = point.label ?? id;
      if (control && control.textContent !== label) control.textContent = label;
    });
    const focus = this.focusTarget ? targets[this.focusTarget] : undefined;
    if (focus) {
      this.ring.style.left = `${focus.x}px`;
      this.ring.style.top = `${focus.y}px`;
    } else this.ring.hidden = true;
    this.refreshGuide(targets);
  }

  private finishGuide(): void {
    if (this.runtime.guideId) setGuideSeen(this.runtime.guideId);
    this.guiding = false;
    element('guide').hidden = true;
    element('guide-pointer').hidden = true;
  }

  private refreshGuide(targets: Record<string, ScreenPoint>): void {
    const step = this.guiding ? this.runtime.guide?.() : undefined;
    const panel = element('guide');
    const pointer = element('guide-pointer');
    if (!step) { panel.hidden = pointer.hidden = true; return; }
    if (step.done) { element('guide-text').textContent = step.text; this.finishGuide(); return; }
    panel.hidden = !element('levels').hidden || !this.card.hidden;
    element('instruction').hidden = true;
    const copy = element('guide-text');
    if (copy.textContent !== step.text) copy.textContent = step.text;
    const at = step.target ? targets[step.target] : undefined;
    pointer.hidden = !at || panel.hidden;
    if (at) { pointer.style.left = `${at.x}px`; pointer.style.top = `${at.y}px`; }
  }

  private localize(): void {
    document.documentElement.lang = locale();
    for (const [id, label] of Object.entries({
      undo: t('Undo', 'Annuler'), restart: t('Restart', 'Recommencer'), hint: t('Hint', 'Indice'), fast: t('Fast forward (hold)', 'Avance rapide (maintenir)'), mute: t('Sound', 'Son'),
      scene: t('Puzzle board', 'Plateau de jeu'), chips: t('Campaign levels', 'Niveaux'), 'board-controls': t('Board pieces', 'Pièces du plateau'), patterns: t('Container patterns', 'Motifs des contenants'),
    })) element(id).setAttribute('aria-label', label);
    element('language-label').textContent = t('Language', 'Langue');
    for (const language of ['en', 'fr'] as const) button(`language-${language}`).setAttribute('aria-pressed', String(locale() === language));
    button('guide-skip').textContent = t('Skip guide', 'Passer le guide');
    button('guide-replay').textContent = t('Restart with guide', 'Recommencer avec le guide');
    button('guide-replay').hidden = !this.runtime.guideId;
    element('guide-pointer-label').textContent = t('Tap here', 'Touchez ici');
    element('patterns').replaceChildren(...(['red', 'blue', 'green', 'yellow', 'orange'] as Color[]).map((color, index) => {
      const item = document.createElement('span');
      item.textContent = `${['○', '◆', '▲', '★', '✚'][index]} ${patternName(color)} = ${colorName(color)}`;
      return item;
    }));
    const level = CAMPAIGN[this.boardIndex];
    if (!level) return;
    element('level-name').textContent = `${this.boardIndex + 1} / ${CAMPAIGN.length} · ${level.name}`;
    element('level-title').textContent = `${level.title} · ${difficultyName(level.difficulty)}`;
    element('difficulty').textContent = difficultyName(level.difficulty);
    element('level-help').textContent = level.instructions;
    element('instruction').textContent = level.instructions;
    this.renderChips();
  }

  private endingCard(): void {
    const next = CAMPAIGN[this.boardIndex + 1];
    if (this.runtime.status === 'won') this.showCard(
      next ? t('Nicely sorted!', 'Bien trié !') : t('Workshop complete!', 'Atelier terminé !'),
      next ? t(`Up next: ${next.name}.`, `À suivre : ${next.name}.`) : t('Every puzzle sorted. Pick a level above to play again.', 'Tous les puzzles sont triés. Choisissez un niveau pour rejouer.'),
      next ? t('Next level', 'Niveau suivant') : t('Play again', 'Rejouer'), 'win');
    else this.showCard(t('A little tangled!', 'Ça coince !'), this.runtime.jamReason, t('Keep looking', 'Continuer à chercher'), 'jam');
  }

  private showLevels(open: boolean): void {
    element('levels').hidden = !open;
    button('levels-toggle').setAttribute('aria-expanded', String(open));
    if (this.runtime) this.refreshGuide(this.runtime.targets());
  }

  private renderChips(): void {
    this.chips.replaceChildren(...CAMPAIGN.map((level, index) => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.dataset['level'] = String(index);
      chip.dataset['kind'] = level.kind;
      chip.classList.toggle('active', index === this.boardIndex);
      chip.textContent = isCompleted(level.id) ? '✓' : String(index + 1);
      chip.setAttribute('aria-label', t(`Level ${index + 1}: ${level.name}, ${difficultyName(level.difficulty)}${isCompleted(level.id) ? ', completed' : ''}`, `Niveau ${index + 1} : ${level.name}, ${difficultyName(level.difficulty)}${isCompleted(level.id) ? ', terminé' : ''}`));
      chip.setAttribute('aria-current', index === this.boardIndex ? 'step' : 'false');
      chip.addEventListener('click', () => { sfx.unlock(); this.showLevels(false); if (index !== this.boardIndex) this.loadBoard(index); });
      return chip;
    }));
  }

  private boxChip(color: Color): HTMLCanvasElement {
    const chip = document.createElement('canvas');
    chip.width = 64;
    chip.height = 64;
    chip.className = 'box-chip';
    chip.style.backgroundColor = COLORS[color].base;
    chip.setAttribute('aria-label', colorName(color));
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
    else if (event.key === 'f' || event.key === 'F') { if (!event.repeat) { sfx.unlock(); this.setFast(true); } }
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
    for (const id of ['undo', 'restart', 'hint', 'fast', 'card-action']) {
      const rect = element(id).getBoundingClientRect();
      targets[id === 'card-action' ? 'card' : id] = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return targets;
  }
  debugState(): Record<string, unknown> {
    const level = CAMPAIGN[this.boardIndex];
    return { levelIndex: this.boardIndex, levelId: level?.id, kind: level?.kind, difficulty: level?.difficulty,
      ...this.runtime.inspect(), status: this.runtime.status, busy: this.runtime.busy, speed: this.speed, entities: this.stage.marbles.count };
  }
}

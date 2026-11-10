import { sfx } from '../audio';
import { CAMPAIGN, TRY_LEVEL } from '../campaign';
import { canEnterProject, workshopProject } from '../world/workshop-projects';
import type { Feedback, GameLevel, GameRuntime, GameServices, ScreenPoint } from '../engine/contracts';
import { FIXED_SECONDS, physics } from '../engine/physics';
import { frameDue } from '../engine/pacing';
import { replayLog, type ReplayLog } from '../engine/replay';
import { Stage } from '../engine/stage';
import { BoardPointer } from '../engine/pointer';
import { completedLevels, currentLevel, isCompleted, markCompleted, selectLevel } from '../progress';
import { COLORS, cargoInk, drawSymbol } from './art';
import { COLORS as PALETTE, type Color } from '../sim/types';
import { colorName, difficultyName, patternName, t } from '../i18n';
import { guideSeen, locale, onLocaleChange, setGuideSeen, setLocale } from '../preferences';
import { enterStop, nextInStop, worldProgress, type WorldProgress } from '../world/progression';
import { filmSeen, initializeValley, markFilmSeen } from '../world/film-progress';
import { WorldView } from './world';
import './world.css';

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
/** Ten rounds of the three games. */
const CHAPTER_LEVELS = 30;

export class App {
  /** Held fast forward runs this many ticks per real tick: a lap of a full belt in a third or a fifth of the time. */
  static readonly FAST_SPEED = 3;
  static readonly FASTER_SPEED = 5;
  /** Below about 40 fps, sustained over the sampling window, the stage steps down a pixel ratio. */
  static readonly SLOW_FRAME_SECONDS = 1 / 40;
  readonly stage: Stage;
  readonly services: GameServices;
  runtime!: GameRuntime;
  boardIndex = 0;
  manualClock = false;
  private accumulator = 0;
  private lastFrame = performance.now();
  private slowTime = 0;
  private slowFrames = 0;
  /** Set by anything that changes the picture outside the simulation: input, undo, a resize, a new level. */
  private redraw = true;
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
  private readonly fastButtons: readonly { readonly speed: number; readonly element: HTMLButtonElement }[] = [
    { speed: App.FAST_SPEED, element: button('fast') },
    { speed: App.FASTER_SPEED, element: button('faster') },
  ];
  /** Independent inputs held right now; the fastest wins, and releasing it falls back to the other. */
  private readonly heldSpeeds = new Map<string, number>();
  private readonly card = element('card');
  private readonly chips = element('chips');
  private readonly ring = element('focus-ring');
  private readonly pointer: BoardPointer;
  private readonly world: WorldView;
  private screen: 'game' | 'map' | 'film' | 'workshop' = 'game';
  private source: 'campaign' | 'workshop' = 'campaign';
  private activeStop: { index: number; replay: boolean } | null = null;

  private get levels(): readonly GameLevel[] { return this.source === 'workshop' ? this.workshopLevels : CAMPAIGN; }
  private worldProgress(): WorldProgress {
    // Only the explicitly appended development trial is outside the registered triples.
    const extraTrial = TRY_LEVEL !== null && CAMPAIGN.length % 3 === 1 && CAMPAIGN.at(-1)?.id === TRY_LEVEL;
    return worldProgress(extraTrial ? CAMPAIGN.slice(0, -1) : CAMPAIGN, new Set(completedLevels()));
  }

  constructor(canvas: HTMLCanvasElement, private readonly workshopLevels: readonly GameLevel[] = []) {
    this.stage = new Stage(canvas);
    this.services = { stage: this.stage, physics };
    this.pointer = new BoardPointer(canvas, {
      unlock: () => sfx.unlock(),
      pick: (point) => this.screen === 'game' ? this.runtime.pick(point.x, point.y) : null,
      tap: (target) => this.activate(target),
      start: (target, point) => {
        const started = this.screen === 'game' && (this.runtime.drag?.start(target, point) ?? false);
        if (started) this.dismissPrompts();
        return started;
      },
      move: (point, target) => { this.runtime.drag?.move(point, target); this.runtime.render(0, 0); },
      end: (target) => { this.feedback(this.runtime.drag?.end(target) ?? []); this.runtime.render(0, 0); this.checkEnding(); this.refresh(); },
      cancel: () => { this.runtime.drag?.cancel(); this.runtime.render(0, 0); this.refresh(); },
    });
    this.world = new WorldView(this.stage, {
      screen: mode => {
        this.pointer.cancel(); this.setFast(false);
        this.screen = mode === 'overview' ? 'map' : mode;
        document.body.dataset['screen'] = this.screen;
        element('load').classList.remove('full', 'jammed');
        element('scene').setAttribute('aria-label', mode === 'film' ? t('Completed marble machine', 'Machine à billes terminée') : t('Village construction map', 'Carte de construction du village'));
        if (this.screen === 'map') {
          const progress = this.worldProgress();
          element('level-name').textContent = t('Valley map', 'Carte de la vallée');
          element('load').textContent = `${progress.stops.filter(stop => stop.status === 'built').length}/${progress.stops.length}`;
        }
      },
      enter: index => this.startStop(index),
      map: () => this.showMap(this.world.currentChapter),
      projectVillage: chapter => this.showMap(chapter),
      workshop: () => this.showWorkshop(),
      playWorkshop: index => { if (this.screen === 'workshop') { this.activeStop = null; this.loadBoard(index, 'workshop'); } },
      filmDone: (chapter, earned) => {
        const progress = this.worldProgress();
        const finished = progress.chapters[chapter];
        if (finished?.complete) markFilmSeen(finished.key);
        this.showMap(earned && progress.chapters[chapter + 1]?.available ? chapter + 1 : chapter);
      },
    });
    const mapButton = document.createElement('button'); mapButton.id = 'map-open';
    mapButton.addEventListener('click', () => { sfx.unlock(); this.showMap(undefined, false, true); });
    element('levels').prepend(mapButton);
    this.undoButton.addEventListener('click', () => this.undo());
    button('restart').addEventListener('click', () => { sfx.unlock(); this.loadBoard(this.boardIndex); });
    button('hint').addEventListener('click', () => { this.hint(); this.refresh(); });
    button('card-action').addEventListener('click', () => {
      sfx.unlock();
      if (this.runtime.status === 'won') {
        if (this.source === 'workshop') this.showWorkshop();
        else {
          const next = this.nextRoundLevel();
          if (next === null) this.showMap(); else this.loadBoard(next);
        }
      }
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
    window.addEventListener('resize', () => { this.pointer.cancel(); this.stage.resized(); this.redraw = true; if (this.screen === 'game') { this.runtime?.resize(); this.refresh(); } else this.world.resize(); });
    document.addEventListener('visibilitychange', () => { this.pointer.cancel(); this.setFast(false); if (document.hidden) sfx.cancel(); this.lastFrame = performance.now(); this.accumulator = 0; this.redraw = true; });
    window.addEventListener('blur', () => { this.setFast(false); sfx.cancel(); });
    // Safari's gesture events have their own default zoom, alongside pointer input.
    for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (event) => {
      if (this.screen === 'game') event.preventDefault();
    }, { passive: false });
    document.addEventListener('keydown', (event) => this.key(event));
    document.addEventListener('keyup', (event) => {
      if (event.key === 'f' || event.key === 'F') this.holdSpeed('key:f', App.FAST_SPEED, false);
      if (event.key === 'g' || event.key === 'G') this.holdSpeed('key:g', App.FASTER_SPEED, false);
    });
    button('language-en').addEventListener('click', () => setLocale('en'));
    button('language-fr').addEventListener('click', () => setLocale('fr'));
    button('guide-skip').addEventListener('click', () => this.finishGuide());
    button('guide-replay').addEventListener('click', () => {
      const id = this.runtime.guideId;
      if (!id) return;
      setGuideSeen(id, false);
      this.loadBoard(this.boardIndex);
    });
    button('copy-replay').addEventListener('click', () => void this.copyReplay());
    onLocaleChange(() => {
      this.pointer.cancel();
      this.setMessage('');
      this.previewKey = '';
      this.redraw = true;
      this.localize();
      if (!this.card.hidden) this.endingCard();
      if (this.screen === 'game') this.refresh();
      else if (this.screen === 'workshop') this.showWorkshop();
      else if (this.screen === 'map') this.showMap(this.world.currentChapter);
    });
  }

  /** Press and hold, on any pointer: capture keeps the release even when the finger slides off. */
  private bindFastForward(): void {
    for (const { speed, element: fast } of this.fastButtons) {
      fast.addEventListener('contextmenu', (event) => event.preventDefault());
      fast.addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });
      fast.addEventListener('pointerdown', (event) => {
        if (fast.disabled) return;
        event.preventDefault();
        sfx.unlock();
        fast.setPointerCapture(event.pointerId);
        this.holdSpeed(`pointer:${speed}:${event.pointerId}`, speed, true);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) fast.addEventListener(type, (event) => this.holdSpeed(`pointer:${speed}:${event.pointerId}`, speed, false));
      fast.addEventListener('keydown', (event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); this.holdSpeed(`button-key:${speed}:${event.key}`, speed, true); } });
      fast.addEventListener('keyup', (event) => { if (event.key === ' ' || event.key === 'Enter') this.holdSpeed(`button-key:${speed}:${event.key}`, speed, false); });
      fast.addEventListener('blur', () => {
        this.holdSpeed(`button-key:${speed}: `, speed, false);
        this.holdSpeed(`button-key:${speed}:Enter`, speed, false);
      });
    }
  }

  get fastForward(): boolean { return this.speed > 1; }

  private holdSpeed(source: string, speed: number, on: boolean): void {
    if (on) this.heldSpeeds.set(source, speed); else this.heldSpeeds.delete(source);
    this.applySpeed();
  }

  /** Hold at this speed, or release every held speed. */
  setFast(on: boolean, speed: number = App.FAST_SPEED): void {
    if (on) this.holdSpeed('manual', speed, true);
    else {
      this.heldSpeeds.clear();
      this.applySpeed();
    }
  }

  private applySpeed(): void {
    const playing = this.screen === 'game' && Boolean(this.runtime) && this.runtime.status === 'playing';
    if (!playing) this.heldSpeeds.clear();
    this.speed = Math.max(1, ...this.heldSpeeds.values());
    for (const { speed, element: fast } of this.fastButtons) {
      const active = this.speed === speed;
      fast.classList.toggle('active', active);
      fast.setAttribute('aria-pressed', String(active));
    }
  }

  static async start(canvas: HTMLCanvasElement, workshopLevels: readonly GameLevel[] = []): Promise<App> {
    await physics.init();
    const app = new App(canvas, workshopLevels);
    const saved = currentLevel();
    const tried = CAMPAIGN.findIndex((level) => level.id === TRY_LEVEL);
    const selected = CAMPAIGN.findIndex((level) => level.id === saved && !isCompleted(level.id));
    const open = CAMPAIGN.findIndex((level) => !isCompleted(level.id));
    const workshopId = new URLSearchParams(location.search).get('workshop');
    const workshop = workshopLevels.findIndex(level => level.id === workshopId);
    initializeValley(app.worldProgress().chapters);
    app.loadBoard(tried >= 0 ? tried : selected >= 0 ? selected : Math.max(0, open));
    if (workshop >= 0) {
      if (canEnterProject(workshopId!, app.worldProgress(), new Set(completedLevels()))) app.loadBoard(workshop, 'workshop');
      else app.showWorkshop(workshopId!);
    }
    else if (tried < 0) app.showMap(undefined, false, true);
    element('boot').hidden = true;
    requestAnimationFrame(app.frame);
    return app;
  }

  private loadBoard(index: number, source = this.source): void {
    this.pointer.cancel();
    const level = (source === 'workshop' ? this.workshopLevels : CAMPAIGN)[index];
    if (!level) throw new Error(`No campaign level ${index}`);
    if (source === 'workshop' && !canEnterProject(level.id, this.worldProgress(), new Set(completedLevels()))) { this.showWorkshop(level.id); return; }
    sfx.cancel();
    window.clearTimeout(this.winTimer);
    window.clearTimeout(this.hintTimer);
    this.setFast(false);
    const transition = Boolean(this.runtime) && (index !== this.boardIndex || source !== this.source || this.screen !== 'game');
    if (transition) { if (this.screen === 'game') this.runtime.render(0, 0); this.world.cover(); }
    this.world.hide();
    if (source === 'workshop') this.workshopRoute(level.id);
    else if (this.source === 'workshop') this.workshopRoute(null);
    this.source = source;
    this.screen = 'game'; document.body.dataset['screen'] = 'game';
    this.runtime?.dispose();
    this.boardIndex = index;
    this.runtime = level.create(this.services);
    this.stage.resized();
    this.redraw = true;
    this.guiding = Boolean(this.runtime.guideId && !guideSeen(this.runtime.guideId));
    if (source === 'campaign') selectLevel(level.id);
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
    // The written instruction belongs to onboarding: every other level lives behind the level pill.
    element('instruction').hidden = !this.guiding;
    window.clearTimeout(this.instructionTimer);
    this.showLevels(false);
    this.renderChips();
    this.runtime.resize();
    this.runtime.render(0, 0);
    // The first draw compiles the level's shaders; reading time and the clock start once it is on screen.
    this.lastFrame = performance.now();
    this.instructionTimer = window.setTimeout(() => { element('instruction').hidden = true; }, 6000);
    this.refresh();
    this.world.reveal();
  }

  private startStop(index: number): void {
    if (this.screen !== 'map') return;
    const stop = this.worldProgress().stops[index];
    if (!stop) return;
    const entry = enterStop(stop, new Set(completedLevels()));
    if (!entry) return;
    sfx.unlock(); this.activeStop = { index, replay: entry.replay };
    if (!entry.replay && this.source === 'campaign' && entry.index === this.boardIndex && this.runtime.game.actions.length > 0) {
      this.world.cover(); this.world.hide();
      this.screen = 'game'; document.body.dataset['screen'] = 'game';
      this.accumulator = 0; this.redraw = true;
      this.localize(); this.runtime.resize(); this.runtime.render(0, 0);
      this.lastFrame = performance.now();
      if (this.runtime.status === 'jammed' && !this.runtime.busy) this.endingCard();
      this.checkEnding(); this.refresh(); this.world.reveal();
      return;
    }
    this.loadBoard(entry.index, 'campaign');
  }

  private nextRoundLevel(): number | null {
    const index = this.activeStop?.index ?? Math.floor(this.boardIndex / 3);
    const stop = this.worldProgress().stops[index];
    if (!stop) return null;
    return nextInStop(stop, this.boardIndex, new Set(completedLevels()), this.activeStop?.replay ?? false);
  }

  private leaveBoard(): void {
    this.pointer.cancel(); this.setFast(false); sfx.cancel();
    window.clearTimeout(this.winTimer); window.clearTimeout(this.hintTimer); window.clearTimeout(this.instructionTimer);
    this.card.hidden = true; this.ring.hidden = true; this.setMessage('');
    element('guide').hidden = element('guide-pointer').hidden = element('instruction').hidden = true;
    element('confetti').replaceChildren(); this.showLevels(false);
    if (this.screen === 'game') this.runtime.render(0, 0);
    // Boot has not exposed a game frame to preserve in a transition snapshot.
    if (element('boot').hidden) this.world.cover();
    this.accumulator = 0; this.lastFrame = performance.now();
  }

  private showMap(chapter?: number, construct = false, earnedFilm = false): void {
    this.workshopRoute(null);
    this.leaveBoard();
    const progress = this.worldProgress();
    const current = chapter ?? Math.floor(Math.min(progress.frontier, Math.max(0, progress.stops.length - 1)) / 10);
    this.world.show(progress, current, construct);
    element('level-name').textContent = t('Valley map', 'Carte de la vallée');
    element('load').textContent = `${progress.stops.filter(stop => stop.status === 'built').length}/${progress.stops.length}`;
    if (earnedFilm) {
      const pending = progress.chapters.find(item => item.complete && !filmSeen(item.key));
      if (pending) this.world.playFilm(pending.index, true);
    }
    this.world.reveal();
  }

  private showWorkshop(focusId?: string): void {
    this.workshopRoute(null);
    this.leaveBoard(); this.world.workshop(this.workshopLevels, this.worldProgress(), focusId);
    element('level-name').textContent = t('Workshop', 'Atelier');
    element('load').textContent = `${this.workshopLevels.filter(level => isCompleted(level.id)).length}/${this.workshopLevels.length}`;
    this.world.reveal();
  }

  private workshopRoute(id: string | null): void {
    const url = new URL(location.href);
    if (id === null) url.searchParams.delete('workshop'); else url.searchParams.set('workshop', id);
    if (url.href !== location.href) history.replaceState(null, '', url);
  }

  private readonly frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    if (!frameDue(now, this.lastFrame)) return;
    const seconds = Math.min(Math.max((now - this.lastFrame) / 1000, 0), 0.25);
    this.lastFrame = now;
    if (!this.manualClock && !document.hidden) {
      const drawn = this.advance(seconds);
      // Only drawn frames say anything about the device: a still board skips drawing and costs nothing.
      if (drawn && this.screen === 'game') {
        this.slowTime += seconds;
        this.slowFrames++;
      }
      if (this.slowTime >= 2.5) {
        if (this.slowTime / this.slowFrames > App.SLOW_FRAME_SECONDS && this.stage.lowerQuality()) this.redraw = true;
        this.slowTime = 0;
        this.slowFrames = 0;
      }
    }
  };

  /** Runs the ticks due and draws, unless the board was still before and after; true when it drew. */
  advance(seconds: number, draw = true): boolean {
    if (this.screen !== 'game') return draw && this.world.advance(this.screen === 'film' ? seconds : Math.min(seconds, 0.05));
    const wasStill = this.runtime.still === true;
    this.accumulator += Math.min(seconds * this.speed, 0.25);
    const limit = 8 * this.speed;
    let steps = 0;
    while (this.accumulator >= FIXED_SECONDS && steps < limit) {
      this.accumulator -= FIXED_SECONDS;
      this.feedback(this.runtime.step());
      steps++;
    }
    if (steps === limit) this.accumulator = 0;
    const drawn = draw && (this.redraw || !wasStill || this.runtime.still !== true);
    if (drawn) {
      this.redraw = false;
      this.runtime.render(this.accumulator / FIXED_SECONDS, seconds);
    }
    this.checkEnding();
    if (drawn || !wasStill) this.refresh();
    return drawn;
  }

  private activate(target: string, keepFocus = false): void {
    if (this.screen !== 'game') return;
    this.redraw = true;
    this.dismissPrompts();
    if (keepFocus) {
      this.focusTarget = target;
      this.ring.hidden = false;
    }
    this.feedback(this.runtime.activate(target));
    this.checkEnding();
    this.refresh();
  }

  /** Picking up a piece answers the hint and the instruction, whether by tap or by drag. */
  private dismissPrompts(): void {
    this.ring.hidden = true;
    this.focusTarget = null;
    this.setMessage('');
    element('instruction').hidden = true;
  }

  private hint(): void {
    if (this.screen !== 'game') return;
    if (this.runtime.status !== 'playing') return;
    sfx.unlock();
    window.clearTimeout(this.hintTimer);
    this.ring.hidden = true;
    this.focusTarget = null;
    this.setMessage('');
    this.feedback(this.runtime.hint());
  }

  private feedback(events: readonly Feedback[]): void {
    // Fast forward triples the event rate, so the small per-marble sounds rest and only the payoffs play.
    const quiet = this.speed > 1;
    if (events.length) this.redraw = true;
    for (const event of events) {
      switch (event.type) {
        case 'tap': if (!quiet) sfx.tap(); break;
        case 'move': sfx.release(); break;
        case 'match': sfx.boxFilled(this.chain++); break;
        case 'blocked': sfx.blocked(); break;
        case 'impact': if (!quiet) sfx.impact(event.strength ?? 0.2); break;
        case 'deliver': if (!quiet) sfx.deliver(event.slot ?? 0); break;
        case 'landing': if (!quiet || event.arrival === 3) sfx.landing(event.arrival); break;
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
    if (this.screen !== 'game') return;
    this.pointer.cancel();
    sfx.unlock();
    if (!this.runtime.undo()) return;
    sfx.cancel();
    this.redraw = true;
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
      const level = this.levels[this.boardIndex];
      if (!level) return;
      markCompleted(level.id);
      sfx.win();
      this.renderChips();
      this.confetti();
      this.winTimer = window.setTimeout(() => {
        if (this.screen !== 'game' || this.runtime.status !== 'won') return;
        if (this.source === 'campaign' && this.nextRoundLevel() === null) {
          this.showMap(Math.floor(this.boardIndex / CHAPTER_LEVELS), true, true);
        } else this.endingCard();
      }, 400);
    } else {
      sfx.jam();
      this.endingCard();
    }
  }

  private refresh(): void {
    const level = this.levels[this.boardIndex];
    if (!level) return;
    const counter = this.runtime.counter;
    const loadText = `${counter.label} ${counter.value}`;
    if (element('load').textContent !== loadText) element('load').textContent = loadText;
    element('load').classList.toggle('full', Boolean(counter.full) && this.runtime.status === 'playing');
    element('load').classList.toggle('jammed', this.runtime.status === 'jammed');
    this.undoButton.disabled = !this.runtime.canUndo;
    this.undoButton.classList.toggle('attention', this.runtime.status === 'jammed');
    button('hint').disabled = this.runtime.status !== 'playing';
    const ended = this.runtime.status !== 'playing';
    for (const { element: fast } of this.fastButtons) fast.disabled = ended;
    if (ended) this.setFast(false);
    const key = this.runtime.preview.join(',');
    if (key !== this.previewKey) {
      this.previewKey = key;
      element('next-boxes').replaceChildren(...this.runtime.preview.map((color) => this.boxChip(color)));
    }
    // Writing an unchanged value still dirties the page's layout, so only real changes are written.
    const next = element('next');
    if (next.hidden !== (this.runtime.preview.length === 0)) next.hidden = this.runtime.preview.length === 0;
    const nextLabel = element('next-label');
    if (nextLabel.textContent !== this.runtime.previewLabel) nextLabel.textContent = this.runtime.previewLabel;
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
    } else if (!this.ring.hidden) this.ring.hidden = true;
    this.refreshGuide(targets);
  }

  private finishGuide(): void {
    if (this.runtime.guideId) setGuideSeen(this.runtime.guideId);
    this.guiding = false;
    element('guide').hidden = true;
    element('guide-pointer').hidden = true;
    element('instruction').hidden = true;
  }

  private refreshGuide(targets: Record<string, ScreenPoint>): void {
    const step = this.guiding ? this.runtime.guide?.() : undefined;
    const panel = element('guide');
    const pointer = element('guide-pointer');
    if (!step) {
      if (!panel.hidden) panel.hidden = true;
      if (!pointer.hidden) pointer.hidden = true;
      return;
    }
    if (step.done) { element('guide-text').textContent = step.text; this.finishGuide(); return; }
    panel.hidden = !element('levels').hidden || !this.card.hidden;
    const copy = element('guide-text');
    if (copy.textContent !== step.text) copy.textContent = step.text;
    const at = step.target ? targets[step.target] : undefined;
    pointer.hidden = !at || panel.hidden;
    if (at) { pointer.style.left = `${at.x}px`; pointer.style.top = `${at.y}px`; }
  }

  private localize(): void {
    document.documentElement.lang = locale();
    for (const [id, label] of Object.entries({
      undo: t('Undo', 'Annuler'), restart: t('Restart', 'Recommencer'), hint: t('Hint', 'Indice'), fast: t('Fast forward ×3 (hold)', 'Avance rapide ×3 (maintenir)'), faster: t('Fast forward ×5 (hold)', 'Avance rapide ×5 (maintenir)'), mute: t('Sound', 'Son'),
      scene: t('Puzzle board', 'Plateau de jeu'), chips: t('Campaign levels', 'Niveaux'), 'board-controls': t('Board pieces', 'Pièces du plateau'), patterns: t('Container patterns', 'Motifs des contenants'),
    })) element(id).setAttribute('aria-label', label);
    element('language-label').textContent = t('Language', 'Langue');
    for (const language of ['en', 'fr'] as const) button(`language-${language}`).setAttribute('aria-pressed', String(locale() === language));
    button('guide-skip').textContent = t('Skip guide', 'Passer le guide');
    button('map-open').textContent = t('Valley map', 'Carte de la vallée');
    button('guide-replay').textContent = t('Restart with guide', 'Recommencer avec le guide');
    button('guide-replay').hidden = !this.runtime.guideId;
    button('copy-replay').textContent = t('Copy this game for a bug report', 'Copier cette partie pour signaler un bug');
    element('guide-pointer-label').textContent = t('Tap here', 'Touchez ici');
    element('patterns').replaceChildren(...PALETTE.map((color) => {
      const item = document.createElement('span');
      const icon = document.createElement('canvas');
      icon.width = icon.height = 64;
      icon.style.width = icon.style.height = '16px';
      icon.style.verticalAlign = 'middle';
      icon.setAttribute('aria-hidden', 'true');
      const context = icon.getContext('2d');
      if (context) { context.fillStyle = '#202335'; drawSymbol(context, color, 32, 32, 26); }
      item.append(icon, ` ${patternName(color)} = ${colorName(color)}`);
      return item;
    }));
    const level = this.levels[this.boardIndex];
    if (!level) return;
    element('level-name').textContent = `${this.boardIndex + 1} / ${this.levels.length} · ${level.name}`;
    element('level-title').textContent = `${level.title} · ${difficultyName(level.difficulty)}`;
    element('difficulty').textContent = difficultyName(level.difficulty);
    element('level-help').textContent = level.instructions;
    element('instruction').textContent = level.instructions;
    this.renderChips();
  }

  private endingCard(): void {
    if (this.source === 'workshop' && this.runtime.status === 'won') {
      const project = workshopProject(this.levels[this.boardIndex]!.id);
      this.showCard(project?.title ?? t('Nicely sorted!', 'Bien trié !'), t('Your village addition is ready.', 'Votre nouvelle construction est prête.'), t('Back to workshop', 'Retour à l’atelier'), 'win');
      return;
    }
    const index = this.nextRoundLevel();
    const next = index === null ? undefined : CAMPAIGN[index];
    if (this.runtime.status === 'won') this.showCard(
      next ? t('Nicely sorted!', 'Bien trié !') : t('Workshop complete!', 'Atelier terminé !'),
      next ? t(`Up next: ${next.name}.`, `À suivre : ${next.name}.`) : t('Every puzzle sorted. Pick a level above to play again.', 'Tous les puzzles sont triés. Choisissez un niveau pour rejouer.'),
      next ? t('Next level', 'Niveau suivant') : t('Play again', 'Rejouer'), 'win');
    else this.showCard(t('A little tangled!', 'Ça coince !'), this.runtime.jamReason, t('Keep looking', 'Continuer à chercher'), 'jam');
  }

  replay(): ReplayLog {
    const level = this.levels[this.boardIndex];
    if (!level) throw new Error(`No campaign level ${this.boardIndex}`);
    return replayLog(level.id, this.runtime.game);
  }

  /** The clipboard needs HTTPS. The development server on a phone falls back to a box to copy from. */
  private async copyReplay(): Promise<void> {
    sfx.unlock();
    const text = JSON.stringify(this.replay());
    this.showLevels(false);
    try {
      await navigator.clipboard.writeText(text);
      this.setMessage(t('Game copied. Paste it into your bug report.', 'Partie copiée. Collez-la dans votre signalement.'), 3000);
    } catch {
      window.prompt(t('Copy this game for your bug report', 'Copiez cette partie pour votre signalement'), text);
    }
  }

  private showLevels(open: boolean): void {
    element('levels').hidden = !open;
    button('levels-toggle').setAttribute('aria-expanded', String(open));
    if (open) this.chips.querySelector('.chip.active')?.scrollIntoView({ block: 'center' });
    if (this.runtime) this.refreshGuide(this.runtime.targets());
  }

  /** Chapters of ten rounds, thirty levels, each under a heading with its completion count; the list scrolls. */
  private renderChips(): void {
    const groups: HTMLElement[] = [];
    for (let start = 0; start < CAMPAIGN.length; start += CHAPTER_LEVELS) {
      const levels = CAMPAIGN.slice(start, start + CHAPTER_LEVELS);
      const done = levels.filter((level) => isCompleted(level.id)).length;
      const last = start + levels.length;
      const head = document.createElement('h3');
      head.className = 'chapter';
      head.textContent = `${t(`Levels ${start + 1}–${last}`, `Niveaux ${start + 1} à ${last}`)} · ${done}/${levels.length}`;
      const grid = document.createElement('div');
      grid.className = 'chapter-chips';
      grid.append(...levels.map((_, offset) => this.chip(start + offset)));
      groups.push(head, grid);
    }
    this.chips.replaceChildren(...groups);
  }

  private chip(index: number): HTMLButtonElement {
    const level = CAMPAIGN[index]!;
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset['level'] = String(index);
    chip.dataset['kind'] = level.kind;
    chip.classList.toggle('active', this.source === 'campaign' && index === this.boardIndex);
    chip.textContent = isCompleted(level.id) ? '✓' : String(index + 1);
    chip.setAttribute('aria-label', t(`Level ${index + 1}: ${level.name}, ${difficultyName(level.difficulty)}${isCompleted(level.id) ? ', completed' : ''}`, `Niveau ${index + 1} : ${level.name}, ${difficultyName(level.difficulty)}${isCompleted(level.id) ? ', terminé' : ''}`));
    chip.setAttribute('aria-current', index === this.boardIndex ? 'step' : 'false');
    chip.addEventListener('click', () => {
      sfx.unlock(); this.showLevels(false);
      const stop = this.worldProgress().stops[Math.floor(index / 3)];
      this.activeStop = stop ? { index: stop.index, replay: stop.status === 'built' } : null;
      if (index !== this.boardIndex || this.screen !== 'game' || this.source !== 'campaign') this.loadBoard(index, 'campaign');
    });
    return chip;
  }

  private boxChip(color: Color): HTMLCanvasElement {
    const chip = document.createElement('canvas');
    chip.width = 64;
    chip.height = 64;
    chip.className = 'box-chip';
    chip.style.backgroundColor = COLORS[color].base;
    chip.setAttribute('aria-label', colorName(color));
    const context = chip.getContext('2d');
    if (context) { context.fillStyle = cargoInk(color); drawSymbol(context, color, 32, 33, 18); }
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
    if (this.screen !== 'game') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' ')) return;
    if (event.key === 'u') this.undo();
    else if (event.key === 'f' || event.key === 'F') { if (!event.repeat) { sfx.unlock(); this.holdSpeed('key:f', App.FAST_SPEED, true); } }
    else if (event.key === 'g' || event.key === 'G') { if (!event.repeat) { sfx.unlock(); this.holdSpeed('key:g', App.FASTER_SPEED, true); } }
    else if (event.key === 'h' && !event.repeat) this.hint();
    else if (event.key === 'r' && !event.repeat) this.loadBoard(this.boardIndex);
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
    for (const id of ['undo', 'restart', 'hint', 'fast', 'faster', 'card-action']) {
      const rect = element(id).getBoundingClientRect();
      targets[id === 'card-action' ? 'card' : id] = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return targets;
  }
  debugState(): Record<string, unknown> {
    const level = this.levels[this.boardIndex];
    return { screen: this.screen, source: this.source, worldChapter: this.world.currentChapter, worldView: this.world.mode,
      levelIndex: this.boardIndex, levelId: level?.id, kind: level?.kind, difficulty: level?.difficulty,
      ...this.runtime.inspect(), status: this.runtime.status, busy: this.runtime.busy, speed: this.speed, entities: this.stage.marbles.count };
  }
}

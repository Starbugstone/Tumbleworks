import { setBoardVillage } from './yard-backdrop';
import { boardChapter } from '../world/board-village';
import { demoEntry, demoFilmChapter, readDemoRoute, returnToDemoMenu } from '../demo';
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
import { showVillageTheme, worldLocation } from '../world/locations';
import { levelIcon } from './level-icon';
import './level-menu.css';
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
  /** Startup resolves after the first screen is visible and can accept input. */
  private onFirstScreen?: () => void;
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
  /** An undo or a hint was used on this level: the send-off is a little smaller, never withheld. */
  private helped = false;
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
  private demoMenuOpen = false;
  private restoringOverlay = false;
  private source: 'campaign' | 'workshop' = 'campaign';
  private activeStop: { index: number; replay: boolean } | null = null;

  private get levels(): readonly GameLevel[] { return this.source === 'workshop' ? this.workshopLevels : CAMPAIGN; }
  private worldProgress(): WorldProgress {
    // Only the explicitly appended development trial is outside the registered triples.
    const extraTrial = TRY_LEVEL !== null && CAMPAIGN.length % 3 === 1 && CAMPAIGN.at(-1)?.id === TRY_LEVEL;
    const completed = new Set(completedLevels());
    if (demoFilmChapter >= 0) for (const level of CAMPAIGN.slice(0, (demoFilmChapter + 1) * CHAPTER_LEVELS)) completed.add(level.id);
    return worldProgress(extraTrial ? CAMPAIGN.slice(0, -1) : CAMPAIGN, completed);
  }

  constructor(canvas: HTMLCanvasElement, private readonly workshopLevels: readonly GameLevel[] = []) {
    this.stage = new Stage(canvas);
    this.services = { stage: this.stage, physics };
    this.pointer = new BoardPointer(canvas, {
      unlock: () => sfx.unlock(),
      pick: (point) => this.screen === 'game' ? this.runtime.pick(point.x, point.y) : null,
      press: target => { if (this.screen === 'game') this.runtime.press?.(target); },
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
        sfx.boardAmbience(false);
        this.pointer.cancel(); this.setFast(false);
        this.screen = mode === 'overview' ? 'map' : mode;
        document.body.dataset['screen'] = this.screen;
        if (mode === 'map' || mode === 'film') showVillageTheme(this.world.currentChapter);
        if (mode === 'film') {
          button('mute').classList.toggle('muted', !sfx.isUnlocked || sfx.isMuted);
          button('mute').setAttribute('aria-label', !sfx.isUnlocked ? t('Enable sound','Activer le son') : t('Sound','Son'));
        } else button('mute').classList.toggle('muted',sfx.isMuted);
        element('load').classList.remove('full', 'jammed');
        element('scene').setAttribute('aria-label', mode === 'film' ? t('Completed marble machine', 'Machine à billes terminée') : t('Village construction map', 'Carte de construction du village'));
        if (this.screen === 'map') {
          element('level-name').textContent = t('Levels', 'Niveaux');
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
    button('map-open').addEventListener('click', () => {
      sfx.unlock();
      if (demoEntry) returnToDemoMenu();
      else if (this.source === 'workshop' && this.screen === 'game') this.showWorkshop();
      else this.showMap(this.menuStop()?.chapter, false, true);
    });
    button('menu-close').addEventListener('click', () => this.showLevels(false));
    element('levels-backdrop').addEventListener('click', () => this.showLevels(false));
    button('menu-settings').addEventListener('click', () => this.showMenuSettings(true));
    button('menu-back').addEventListener('click', () => this.showMenuSettings(false));
    this.undoButton.addEventListener('click', () => this.undo());
    button('restart').addEventListener('click', () => { sfx.unlock(); this.loadBoard(this.boardIndex); });
    button('hint').addEventListener('click', () => { this.hint(); this.refresh(); });
    button('card-action').addEventListener('click', () => {
      sfx.unlock();
      if (this.runtime.status === 'won') {
        if (demoEntry) { returnToDemoMenu(); return; }
        if (this.source === 'workshop') this.showWorkshop();
        else {
          const next = this.nextRoundLevel();
          if (next === null) this.showMap(); else this.loadBoard(next);
        }
      }
      else {
        if (demoEntry && history.state?.overlay === 'result') history.back();
        this.undo();
      }
    });
    button('card-restart').addEventListener('click', () => {
      sfx.unlock();
      if (demoEntry && history.state?.overlay === 'result') history.back();
      this.loadBoard(this.boardIndex);
    });
    canvas.addEventListener('pointerup', () => {
      if (this.ending !== 'won' || !this.card.hidden || this.screen !== 'game') return;
      window.clearTimeout(this.winTimer);
      this.finishWin();
    });
    this.bindFastForward();
    const toggle = button('levels-toggle');
    toggle.addEventListener('click', () => {
      sfx.unlock();
      const open = element('levels').hidden !== false;
      if (open && demoEntry && !history.state?.overlay) history.pushState({ ...history.state, overlay: 'levels' }, '');
      this.showLevels(open);
    });
    const mute = button('mute');
    mute.classList.toggle('muted', sfx.isMuted);
    mute.addEventListener('click', () => {
      const enableFilm = this.screen === 'film' && !sfx.isUnlocked && !sfx.isMuted;
      sfx.unlock();
      mute.classList.toggle('muted', enableFilm ? false : sfx.toggleMute());
      mute.setAttribute('aria-label', t('Sound', 'Son'));
      mute.setAttribute('aria-pressed', String(sfx.isMuted));
    });
    this.world.element.addEventListener('pointerdown', () => {
      sfx.unlock();
      mute.classList.toggle('muted', sfx.isMuted);
      mute.setAttribute('aria-label', t('Sound', 'Son'));
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
    sfx.boardFastForward(this.speed > 1);
    if (this.runtime) this.runtime.pace?.(this.speed);
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
    const tried = CAMPAIGN.findIndex((level) => level.id === (demoEntry ?? TRY_LEVEL));
    const selected = CAMPAIGN.findIndex((level) => level.id === saved && !isCompleted(level.id));
    const open = CAMPAIGN.findIndex((level) => !isCompleted(level.id));
    const workshopId = new URLSearchParams(location.search).get('workshop');
    const workshop = workshopLevels.findIndex(level => level.id === workshopId);
    initializeValley(app.worldProgress().chapters);
    app.loadBoard(tried >= 0 ? tried : selected >= 0 ? selected : Math.max(0, open));
    if (demoEntry) document.body.classList.add('demo');
    if (demoEntry === 'levels') app.showLevels(true);
    else if (demoFilmChapter >= 0 && demoFilmChapter < app.worldProgress().chapters.length) {
      app.showMap(demoFilmChapter);
      app.world.playFilm(demoFilmChapter);
    } else if (workshop >= 0) {
      if (canEnterProject(workshopId!, app.worldProgress(), new Set(completedLevels()))) app.loadBoard(workshop, 'workshop');
      else app.showWorkshop(workshopId!);
    }
    else if (tried < 0) app.showMap(undefined, false, true);
    await new Promise<void>(resolve => {
      app.onFirstScreen = resolve;
      requestAnimationFrame(app.frame);
    });
    return app;
  }

  restoreDemoOverlay(overlay: unknown): void {
    this.restoringOverlay = true;
    this.showLevels(overlay === 'levels');
    if (overlay === 'result' && this.ending !== 'none') this.endingCard();
    else this.card.hidden = true;
    this.restoringOverlay = false;
  }

  pauseForDemos(): void {
    this.leaveBoard();
    this.world.hide();
    this.demoMenuOpen = true;
  }

  openDemoRoute(): void {
    readDemoRoute();
    this.demoMenuOpen = false;
    this.activeStop = null;
    const index = CAMPAIGN.findIndex(level => level.id === demoEntry);
    if (demoFilmChapter >= 0 && demoFilmChapter < this.worldProgress().chapters.length) {
      this.showMap(demoFilmChapter);
      this.world.playFilm(demoFilmChapter);
    } else {
      this.loadBoard(Math.max(0, index), 'campaign');
      if (demoEntry === 'levels') this.showLevels(true);
    }
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
    if (transition && element('boot').hidden) { if (this.screen === 'game') this.runtime.render(0, 0); this.world.cover(); }
    this.world.hide();
    if (source === 'workshop') this.workshopRoute(level.id);
    else if (this.source === 'workshop') this.workshopRoute(null);
    this.source = source;
    this.screen = 'game'; document.body.dataset['screen'] = 'game';
    this.runtime?.dispose();
    this.boardIndex = index;
    // The board stands in its own village: a campaign level in the chapter it belongs to, a Workshop project in the village it builds for.
    const chapter = boardChapter(source,index,level.id);
    setBoardVillage(chapter);
    sfx.boardAmbience(true, chapter ?? 0);
    if (chapter !== null) showVillageTheme(chapter);
    this.runtime = level.create(this.services);
    this.runtime.pace?.(this.speed);
    this.helped = false;
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
    // During boot the first frame draws the selected destination, which may be the village.
    if (element('boot').hidden) this.runtime.render(0, 0);
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
      sfx.boardAmbience(true, stop.chapter);
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
    this.pointer.cancel(); this.setFast(false); sfx.cancel(); sfx.boardAmbience(false);
    window.clearTimeout(this.winTimer); window.clearTimeout(this.hintTimer); window.clearTimeout(this.instructionTimer);
    this.card.hidden = true; this.ring.hidden = true; this.setMessage('');
    element('guide').hidden = element('guide-pointer').hidden = element('instruction').hidden = true;
    element('confetti').replaceChildren(); this.showLevels(false);
    if (element('boot').hidden) {
      if (this.screen === 'game') this.runtime.render(0, 0);
      this.world.cover();
    }
    this.accumulator = 0; this.lastFrame = performance.now();
  }

  private showMap(chapter?: number, construct = false, earnedFilm = false): void {
    this.workshopRoute(null);
    this.leaveBoard();
    const progress = this.worldProgress();
    const current = chapter ?? Math.floor(Math.min(progress.frontier, Math.max(0, progress.stops.length - 1)) / 10);
    this.world.show(progress, current, construct);
    element('level-name').textContent = t('Levels', 'Niveaux');
    if (earnedFilm) {
      const pending = progress.chapters.find(item => item.complete && !filmSeen(item.key));
      if (pending) this.world.playFilm(pending.index, true);
    }
    this.world.reveal();
  }

  private showWorkshop(focusId?: string): void {
    this.workshopRoute(null);
    this.leaveBoard(); this.world.workshop(this.workshopLevels, this.worldProgress(), focusId);
    element('level-name').textContent = t('Levels', 'Niveaux');
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
    if (!this.manualClock && !this.demoMenuOpen && !document.hidden) {
      const drawn = this.advance(seconds);
      if (this.onFirstScreen && (this.screen === 'game' || this.screen === 'workshop' ||
          (this.screen === 'film' ? ['ready','unavailable'].includes(this.stage.canvas.dataset.worldFilm ?? '') :
            ['ready','unavailable'].includes(this.stage.canvas.dataset.worldScene ?? '')))) {
        element('boot').hidden = true;
        element('hud').removeAttribute('inert');
        this.onFirstScreen();
        this.onFirstScreen = undefined;
      }
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
    this.helped = true;
    this.feedback(this.runtime.hint());
  }

  private feedback(events: readonly Feedback[]): void {
    // Fast forward triples the event rate, so the small per-marble sounds rest and only the payoffs play.
    const quiet = this.speed > 1;
    if (events.length) this.redraw = true;
    for (const event of events) {
      switch (event.type) {
        case 'tap': if (!quiet) { sfx.tap(); } break;
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
    this.helped = true;
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
      sfx.finalLoad();
      this.renderChips();
      element('guide').hidden = element('instruction').hidden = true;
      this.runtime.celebrate?.(this.helped ? 0.65 : 1);
      this.winTimer = window.setTimeout(() => this.finishWin(), 1250);
    } else {
      sfx.jam();
      this.endingCard();
    }
  }

  private finishWin(): void {
    if (this.screen !== 'game' || this.runtime.status !== 'won') return;
    if (!demoEntry && this.source === 'campaign' && this.nextRoundLevel() === null) {
      this.showMap(Math.floor(this.boardIndex / CHAPTER_LEVELS), true, true);
    } else this.endingCard();
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
    const step = this.screen === 'game' && this.guiding ? this.runtime.guide?.() : undefined;
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
      scene: t('Puzzle board', 'Plateau de jeu'), chips: t('Round levels', 'Niveaux de l’étape'), 'board-controls': t('Board pieces', 'Pièces du plateau'), patterns: t('Container patterns', 'Motifs des contenants'),
    })) element(id).setAttribute('aria-label', label);
    element('language-label').textContent = t('Language', 'Langue');
    for (const language of ['en', 'fr'] as const) button(`language-${language}`).setAttribute('aria-pressed', String(locale() === language));
    button('guide-skip').setAttribute('aria-label', t('Skip guide', 'Passer le guide'));
    element('skip-label').textContent = t('Skip guide', 'Passer le guide');
    element('levels').setAttribute('aria-label', t('Levels', 'Niveaux'));
    button('levels-toggle').setAttribute('aria-label', t('Levels', 'Niveaux'));
    button('menu-close').setAttribute('aria-label', t('Close menu', 'Fermer le menu'));
    button('menu-settings').setAttribute('aria-label', t('Settings and help', 'Réglages et aide'));
    button('menu-back').setAttribute('aria-label', t('Back to levels', 'Retour aux niveaux'));
    element('menu-heading').textContent = t('Settings and help', 'Réglages et aide');
    element('help-label').textContent = t('How to play', 'Comment jouer');
    button('guide-replay').textContent = t('Restart with guide', 'Recommencer avec le guide');
    button('guide-replay').hidden = !this.runtime.guideId;
    button('copy-replay').hidden = !import.meta.env.DEV || !new URLSearchParams(location.search).has('diagnostics');
    button('copy-replay').textContent = t('Copy this game for a bug report', 'Copier cette partie pour signaler un bug');
    element('guide-pointer-label').textContent = t('Tap here', 'Touchez ici');
    element('patterns').replaceChildren(...PALETTE.map((color) => {
      const item = document.createElement('span');
      const icon = document.createElement('canvas');
      icon.width = icon.height = 64;
      icon.style.width = icon.style.height = '24px';
      icon.style.verticalAlign = 'middle';
      icon.setAttribute('aria-hidden', 'true');
      const context = icon.getContext('2d');
      if (context) {
        context.fillStyle = COLORS[color].base;
        context.fillRect(0, 0, 64, 64);
        context.fillStyle = cargoInk(color);
        drawSymbol(context, color, 32, 32, 19);
      }
      item.append(icon, ` ${colorName(color)}`);
      item.setAttribute('role', 'img');
      item.setAttribute('aria-label', `${patternName(color)} = ${colorName(color)}`);
      return item;
    }));
    const level = this.levels[this.boardIndex];
    if (!level) return;
    element('level-name').textContent = `${this.boardIndex + 1} · ${level.name}`;
    element('level-title').textContent = `${level.title} · ${difficultyName(level.difficulty)}`;
    element('level-help').textContent = level.instructions;
    element('instruction').textContent = this.runtime.guide?.().prompt ?? t('Follow the hand', 'Suivez la main');
    this.renderChips();
  }

  private endingCard(): void {
    if (this.runtime.status === 'jammed') {
      this.showCard(this.runtime.jamSummary ?? t('No moves left', 'Aucun coup possible'), this.runtime.jamReason, t('Undo', 'Annuler'), 'jam');
      return;
    }
    const project = this.source === 'workshop' ? workshopProject(this.levels[this.boardIndex]!.id) : undefined;
    const stop = this.worldProgress().stops[Math.floor(this.boardIndex / 3)];
    const island = worldLocation(project?.chapter ?? stop?.chapter ?? 0);
    const progress = project ? island.name : t(`${island.name} · Stop ${(stop?.local ?? 0) + 1}`, `${island.name} · Étape ${(stop?.local ?? 0) + 1}`);
    const action = demoEntry ? t('Back to demos', 'Retour aux démos') : project
      ? t('Back to workshop', 'Retour à l’atelier') : t('Play next level', 'Jouer au niveau suivant');
    this.showCard(t('Nicely sorted!', 'Bien trié !'), progress, action, 'win');
    const pips = element('stop-progress');
    pips.hidden = !!project;
    if (!project && stop) {
      pips.replaceChildren(...stop.levels.map(level => {
        const pip = document.createElement('span');
        pip.textContent = isCompleted(level.id) ? '✓' : '○';
        return pip;
      }));
      pips.setAttribute('role', 'img');
      pips.removeAttribute('aria-hidden');
      pips.setAttribute('aria-label', t(`${stop.completed} of 3 puzzles complete`, `${stop.completed} jeux terminés sur 3`));
    }
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
    const wasOpen = !element('levels').hidden;
    if (!open && wasOpen && demoEntry && !this.restoringOverlay && history.state?.overlay === 'levels') history.back();
    if (open) {
      this.pointer.cancel();
      this.setFast(false);
      this.renderChips(true);
      this.showMenuSettings(false, false);
    }
    element('levels').hidden = !open;
    element('levels-backdrop').hidden = !open;
    button('levels-toggle').setAttribute('aria-expanded', String(open));
    if (open) button('menu-close').focus({ preventScroll: true });
    else if (wasOpen) button('levels-toggle').focus({ preventScroll: true });
    if (this.runtime) this.refreshGuide(this.runtime.targets());
  }

  private showMenuSettings(settings: boolean, focus = true): void {
    element('menu-main').hidden = settings;
    element('menu-secondary').hidden = !settings;
    button('map-open').hidden = settings || (!demoEntry && this.screen === 'map');
    button('menu-settings').hidden = settings;
    button('menu-back').hidden = !settings;
    element('menu-heading').hidden = !settings;
    if (focus) button(settings ? 'menu-back' : 'menu-settings').focus({ preventScroll: true });
  }

  private menuStop() {
    const progress = this.worldProgress();
    if (this.screen === 'map' || this.screen === 'workshop') {
      const stops = progress.chapters[this.world.currentChapter]?.stops;
      return stops?.find(stop => stop.status === 'available') ?? stops?.at(-1);
    }
    if (this.source === 'workshop') return undefined;
    return progress.stops.find(stop => this.boardIndex >= stop.firstLevel && this.boardIndex < stop.firstLevel + stop.levels.length);
  }

  /** The village owns the campaign; this menu only selects among one stop's three puzzles. */
  private renderChips(opening = false): void {
    if (demoEntry && this.source === 'campaign') {
      if (opening || !element('levels').hidden) {
        element('map-label').textContent = t('Back to demos', 'Retour aux démos');
        element('menu-round').textContent = t('All levels', 'Tous les niveaux');
        this.chips.replaceChildren(...CAMPAIGN.map((_, index) => this.chip(index)));
      }
      return;
    }
    const stop = this.menuStop();
    const project = this.source === 'workshop' && this.screen === 'game';
    element('map-label').textContent = project ? t('Back to workshop', 'Retour à l’atelier') : t('Back to village', 'Retour au village');
    element('menu-round').textContent = stop
      ? `${worldLocation(stop.chapter).name} · ${t(`Round ${stop.index + 1}`, `Étape ${stop.index + 1}`)}`
      : project ? t('Workshop', 'Atelier') : t('Trial level', 'Niveau d’essai');
    const indexes = stop ? stop.levels.map((_, offset) => stop.firstLevel + offset) : [this.boardIndex];
    this.chips.replaceChildren(...indexes.map(index => this.chip(index, this.screen !== 'game' && stop?.status === 'locked')));
  }

  private chip(index: number, locked = false): HTMLButtonElement {
    const menuSource = this.screen === 'game' ? this.source : 'campaign';
    const level = (menuSource === 'campaign' ? CAMPAIGN : this.workshopLevels)[index]!;
    const chip = document.createElement('button');
    const active = this.screen === 'game' && index === this.boardIndex;
    const completed = isCompleted(level.id);
    chip.className = 'chip';
    chip.dataset['level'] = String(index);
    chip.dataset['kind'] = level.kind;
    chip.classList.toggle('active', active);
    chip.classList.toggle('completed', completed);
    const name = document.createElement('span');
    name.className = 'level-game';
    name.textContent = level.name;
    const number = document.createElement('span');
    number.className = 'level-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = completed && !active ? '✓' : String(index + 1);
    chip.append(levelIcon(level.kind), name, number);
    chip.setAttribute('aria-label', t(`Level ${index + 1}: ${level.name}${completed ? ', completed' : ''}`, `Niveau ${index + 1} : ${level.name}${completed ? ', terminé' : ''}`));
    chip.setAttribute('aria-current', active ? 'step' : 'false');
    chip.setAttribute('aria-disabled', String(locked));
    chip.addEventListener('click', () => {
      if (locked) return;
      sfx.unlock(); this.showLevels(false);
      const stop = menuSource === 'campaign' ? this.worldProgress().stops.find(stop => index >= stop.firstLevel && index < stop.firstLevel + stop.levels.length) : undefined;
      this.activeStop = stop ? { index: stop.index, replay: stop.status === 'built' } : null;
      if (!active) {
        if (this.screen === 'map' && stop && enterStop(stop, new Set(completedLevels()))?.index === index) this.startStop(stop.index);
        else this.loadBoard(index, menuSource);
      }
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
    element('guide').hidden = element('instruction').hidden = true;
    element('stop-progress').hidden = true;
    button('card-restart').hidden = kind !== 'jam';
    button('card-restart').textContent = t('Restart', 'Recommencer');
    element('card-title').textContent = title;
    element('card-body').textContent = text;
    button('card-action').textContent = action;
    this.card.dataset['kind'] = kind;
    if (this.card.hidden && demoEntry && !this.restoringOverlay && !history.state?.overlay) history.pushState({ ...history.state, overlay: 'result' }, '');
    this.card.hidden = false;
  }
  private key(event: KeyboardEvent): void {
    if (!element('levels').hidden) {
      if (event.key === 'Escape') { event.preventDefault(); this.showLevels(false); }
      else if (event.key === 'Tab') {
        const controls = [...element('levels').querySelectorAll<HTMLElement>('button, summary')].filter(control => control.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      return;
    }
    if (this.demoMenuOpen || this.screen !== 'game') return;
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

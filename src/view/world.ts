import { demoFilmChapter, returnToDemoMenu } from '../demo';
import * as THREE from 'three';
import { confetti } from './confetti';
import { DEEP_SEA } from '../engine/stage';
import type { Stage } from '../engine/stage';
import type { GameLevel } from '../engine/contracts';
import { t } from '../i18n';
import { worldLocation } from '../world/locations';
import type { WorldChapter, WorldProgress } from '../world/progression';
import { WorldScene } from './world-scene';
import { WorldFilm } from './world-film';
import { SceneBuild } from './scene-build';
import { VillageOwnership } from './village-ownership';
import { WorldKitAssets } from './world-kit';
import { ValleyOverview } from './valley-overview';
import { completedLevels } from '../progress';
import { sfx } from '../audio';
import { WORKSHOP_PROJECTS, projectState } from '../world/workshop-projects';

interface WorldActions {
  screen(mode: 'map' | 'overview' | 'workshop' | 'film'): void;
  enter(round: number): void;
  map(): void;
  projectVillage(chapter: number): void;
  workshop(): void;
  playWorkshop(index: number): void;
  filmDone(chapter: number, earned: boolean): void;
}

const makeButton = (text: string, action: () => void, className = ''): HTMLButtonElement => {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
  button.className = className; button.addEventListener('click', action); return button;
};

function lockIcon(): HTMLElement {
  const icon = document.createElement('i');
  icon.className = 'wv-lock'; icon.setAttribute('aria-hidden', 'true');
  return icon;
}

function constructionCaption(chapter: WorldChapter): string {
  const built = chapter.stops.filter(stop => stop.status === 'built').length;
  return t(`${built} of ${chapter.stops.length} stops built`, `Étapes construites · ${built}/${chapter.stops.length}`);
}

/** Map controls live in the DOM; its miniature shares the game's renderer and rests between interactions. */
export class WorldView {
  readonly element = document.createElement('section');
  private readonly heading = document.createElement('header');
  private readonly nodes = document.createElement('nav');
  private readonly footer = document.createElement('footer');
  private readonly panel = document.createElement('div');
  private readonly filmControls = document.createElement('div');
  private readonly filmNote = document.createElement('small');
  private filmFinished=false;
  private filmWait: 'waiting' | 'ready' | 'failed' = 'ready';
  /** Calm empty backdrop (the village background colour) while a village is being built. */
  private readonly blankScene = new THREE.Scene();
  private readonly blankCamera = new THREE.PerspectiveCamera();
  private pendingConstruct = false;
  private holdBuildCover = false;
  private readonly curtain = document.createElement('canvas');
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  /** Scenes, builds and their proofs are owned here; `scene` is only ever a BUILT map scene. */
  private readonly ownership: VillageOwnership<WorldScene>;
  private get scene(): WorldScene | null { return this.ownership.scene; }
  private progress: WorldProgress | null = null;
  private chapter = 0;
  private dirty = true;
  private view: 'map' | 'overview' | 'workshop' | 'film' = 'map';
  private playback: WorldFilm | null = null;
  private filmTime = 0;
  private harbourFrame = 0;
  private playing = false;
  private valley: ValleyOverview | null = null;
  private valleyAssets: WorldKitAssets | null = null;
  private gesture: { id: number; x: number; y: number; moved: boolean; target: HTMLElement; focus: HTMLElement | null } | null = null;
  private draggedLabel: HTMLElement | null = null;
  private readonly mapPointers = new Map<number, { x:number; y:number; startX:number; startY:number }>();
  private mapMoved = false;
  private suppressMapClick = false;
  private readonly viewControls = document.createElement('div');
  private readonly resetView = makeButton('↺', () => { this.scene?.resetView();this.mapChanged(); }, 'wv-reset-view');
  private filmIndex = 0;
  private lockTimer = 0;
  private transitionTimer = 0;
  private transitionFrame = 0;
  private earnedFilm = false;
  private readonly seenProjects = new Set<string>();
  private projectNoticeInitialized = false;

  constructor(private readonly stage: Stage, private readonly actions: WorldActions) {
    this.element.id = 'world'; this.element.hidden = true;
    this.nodes.id = 'world-stops';
    this.heading.className = 'wv-heading'; this.footer.className = 'wv-footer';
    this.panel.className = 'wv-panel'; this.panel.hidden = true;
    this.filmControls.className = 'wv-film-controls'; this.filmControls.hidden = true;
    this.filmNote.className = 'wv-film-status'; this.filmNote.setAttribute('role', 'status');
    this.blankScene.background = new THREE.Color(DEEP_SEA);
    this.ownership = new VillageOwnership(chapter => new SceneBuild(chapter, this.stage, {motion:'cinematic'}), () => this.built(), false);
    this.element.append(this.heading, this.nodes, this.panel, this.footer, this.filmControls);
    document.getElementById('hud')!.prepend(this.element);
    this.curtain.id = 'journey-transition'; this.curtain.hidden = true; this.curtain.setAttribute('aria-hidden', 'true'); document.body.append(this.curtain);
    this.viewControls.className='wv-view-controls';this.resetView.setAttribute('aria-label',t('Reset village view','Recentrer le village'));this.viewControls.append(this.resetView);this.element.append(this.viewControls);
    this.bindWorldPointer();
  }

  show(progress: WorldProgress, chapter: number, construct = false): void {
    const returningFromFilm=this.view==='film';this.clearMapPointers();
    const fromMap = this.view === 'map' && !this.element.hidden;
    this.disposeValley();
    this.stopFilm(); this.progress = progress;
    this.panel.classList.remove('wv-overview-panel');
    this.chapter = Math.max(0, Math.min(chapter, progress.chapters.length - 1));
    this.view = 'map'; this.element.hidden = false;this.viewControls.hidden=false;this.resetView.hidden=!this.scene?.orbit.changed; this.panel.hidden = true;
    this.resetView.setAttribute('aria-label',t('Reset village view','Recentrer le village'));
    window.clearTimeout(this.lockTimer);
    this.footer.classList.remove('wv-workshop-footer');
    sfx.harbourAmbience(true, this.chapter);
    this.actions.screen(this.view);
    this.heading.hidden = this.nodes.hidden = this.footer.hidden = false;
    this.nodes.setAttribute('aria-label', t('Construction stops', 'Étapes de construction'));
    const current = progress.chapters[this.chapter];
    // Switching villages: the old view stays, dimmed, until the new one is drawn (reduced motion: plain backdrop).
    if (fromMap && this.scene && this.scene.chapter !== this.chapter && !this.reduced.matches) { this.cover(); this.holdBuildCover = true; this.curtain.classList.add('wv-building'); this.curtain.style.opacity = '0.4'; }
    this.pendingConstruct = construct && !this.reduced.matches;
    if (current && this.scene?.chapter === this.chapter) { this.scene.update(current, this.pendingConstruct);if(!returningFromFilm)this.scene.orbit.reset();this.scene.inspect(); }
    this.ownership.showMap(this.chapter); // retained: activates its proof after update; else builds
    this.stage.canvas.dataset['worldScene'] = this.scene ? 'ready' : 'building';
    if (!current) return;
    const location = worldLocation(this.chapter);
    const title = document.createElement('h1'); title.textContent = location.name;
    const subtitle = document.createElement('p'); subtitle.textContent = this.scene ? constructionCaption(current) : t('Getting the village ready…', 'Préparation du village…');
    if (!this.scene) subtitle.setAttribute('role', 'status');
    this.heading.replaceChildren(title, subtitle);
    this.nodes.replaceChildren(...current.stops.map(stop => {
      const button = makeButton('', () => {
        if (stop.status === 'locked') {
          this.explainLockedStop(button, current);
        } else {
          this.actions.enter(stop.index);
        }
      }, 'map-stop');
      button.dataset['round'] = String(stop.index); button.dataset['status'] = stop.status;
      button.setAttribute('aria-disabled', String(stop.status === 'locked'));
      const face = document.createElement('span'); face.className = 'wv-stop-face'; face.setAttribute('aria-hidden', 'true');
      if (stop.status === 'locked') face.append(lockIcon());
      else face.textContent = stop.status === 'built' ? '✓' : String(stop.local + 1);
      button.setAttribute('aria-label', t(`Construction stop ${stop.index + 1}, ${stop.completed} of 3 puzzles completed${stop.status === 'locked' ? ', locked' : ''}`, `Étape de construction ${stop.index + 1}, ${stop.completed} puzzles sur 3 terminés${stop.status === 'locked' ? ', verrouillée' : ''}`));
      button.setAttribute('aria-current', stop.index === progress.frontier ? 'step' : 'false');
      const dots = document.createElement('span'); dots.className = 'map-dots'; dots.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 3; i++) { const dot = document.createElement('i'); dot.classList.toggle('done', i < stop.completed); dots.append(dot); }
      face.append(dots); button.append(face); return button;
    }));
    const primary = document.createElement('div'); primary.className = 'wv-primary';
    const hasNext = progress.frontier < progress.stops.length;
    if (current.complete) {
      const film = makeButton(hasNext ? 'Film' : t('▶ Watch your machine', '▶ Voir votre machine'), () => this.playFilm(this.chapter), hasNext ? 'wv-soft' : 'wv-film-button');
      if (hasNext) film.setAttribute('aria-label', t('Film · Watch your machine', 'Film · Voir votre machine'));
      primary.append(film);
    }
    if (hasNext) primary.append(makeButton(t('▶ Play next level', '▶ Jouer le niveau suivant'), () => this.actions.enter(progress.frontier), 'wv-play'));
    const nav = document.createElement('div'); nav.className = 'wv-nav';
    const previous = makeButton('‹', () => this.show(progress, this.chapter - 1), 'wv-arrow');
    previous.setAttribute('aria-label', t('Previous location', 'Lieu précédent')); previous.disabled = this.chapter === 0;
    const next = makeButton('›', () => this.show(progress, this.chapter + 1), 'wv-arrow');
    next.setAttribute('aria-label', t('Next location', 'Lieu suivant')); next.disabled = !progress.chapters[this.chapter + 1]?.available;
    const atelier = makeButton(t('Workshop', 'Atelier'), () => this.actions.workshop(), 'wv-soft');
    atelier.id = 'world-workshop';
    atelier.dataset['worldWorkshop'] = '';
    const completed = new Set(completedLevels());
    const available = WORKSHOP_PROJECTS.filter(project => projectState(project, progress, completed).status === 'available');
    if (!this.projectNoticeInitialized) { available.forEach(project => this.seenProjects.add(project.id)); this.projectNoticeInitialized = true; }
    if (available.some(project => !this.seenProjects.has(project.id))) {
      const dot = document.createElement('i'); dot.className = 'wv-project-notice'; dot.setAttribute('aria-hidden', 'true');
      atelier.append(dot); atelier.setAttribute('aria-description', t('A new village project is available.', 'Un nouveau projet de village est disponible.'));
    }
    if (!previous.disabled) nav.append(previous);
    nav.append(makeButton(t('Islands', 'Îles'), () => this.overview(), 'wv-soft'), atelier);
    if (!next.disabled) nav.append(next);
    if (demoFilmChapter >= 0) {
      const back = makeButton(t('Back to demos', 'Retour aux démos'), returnToDemoMenu, 'wv-soft');
      const replay = makeButton(t('Replay film', 'Revoir le film'), () => this.playFilm(this.chapter), 'wv-film-button');
      primary.replaceChildren(back, replay);
      this.footer.replaceChildren(primary);
    } else this.footer.replaceChildren(primary, nav);
    this.nodes.hidden = !this.scene;
    this.resetView.hidden=!this.scene?.orbit.changed;this.positions(); this.dirty = true;
    if (this.scene) this.scene.draw(); else this.drawBlank();
  }
  private explainLockedStop(button: HTMLButtonElement, chapter: WorldChapter): void {
    const next = this.progress?.stops[this.progress.frontier];
    const caption = this.heading.querySelector('p');
    if (!next || !caption) return;
    sfx.unlock(); sfx.blocked();
    window.clearTimeout(this.lockTimer);
    for (const pin of this.nodes.querySelectorAll('.wv-locked-tap')) pin.classList.remove('wv-locked-tap');
    const playable = this.nodes.querySelector('[aria-current="step"]');
    button.classList.add('wv-locked-tap'); playable?.classList.add('wv-next-stop');
    caption.setAttribute('role', 'status');
    caption.textContent = next.chapter === chapter.index
      ? t(`Build stop ${next.local + 1} first`, `Construisez d’abord l’étape ${next.local + 1}`)
      : t(`Continue at ${worldLocation(next.chapter).name}`, `Continuez à ${worldLocation(next.chapter).name}`);
    this.lockTimer = window.setTimeout(() => {
      button.classList.remove('wv-locked-tap'); playable?.classList.remove('wv-next-stop');
      caption.textContent = constructionCaption(chapter);
    }, 1500);
  }

  /** A build settled: the map scene a film also borrows. Called before its proof is activated. */
  private built(): void {
    if (this.element.hidden) return;
    if (this.view === 'film') { this.filmBuilt(); return; }
    if (this.view !== 'map' || !this.progress) return;
    const current = this.progress.chapters[this.chapter], scene = this.scene, subtitle = this.heading.querySelector('p');
    if (!scene || scene.chapter !== this.chapter || !current) {
      if (subtitle && this.ownership.failedChapter === this.chapter) subtitle.textContent = t('This village can’t be shown right now.', 'Ce village ne peut pas être affiché pour l’instant.');
      if (this.ownership.failedChapter === this.chapter) { this.stage.canvas.dataset['worldScene'] = 'unavailable'; this.releaseBuildCover(); }
      return;
    }
    scene.resize(); scene.update(current, this.pendingConstruct);scene.inspect();
    if (subtitle) { subtitle.removeAttribute('role'); subtitle.textContent = constructionCaption(current); }
    this.nodes.hidden = false; this.stage.canvas.dataset['worldScene'] = 'ready';
    this.resetView.hidden=!scene.orbit.changed;this.positions(); this.dirty = true; scene.draw(); this.releaseBuildCover(); this.reveal();
  }
  private drawBlank(): void { this.stage.draw(this.blankScene, this.blankCamera); }
  private releaseBuildCover(): void { const held = this.holdBuildCover; this.holdBuildCover = false; if (held) this.reveal(); }

  private overview(): void {
    if (!this.progress) return;
    this.clearMapPointers();this.viewControls.hidden=true;this.releaseBuildCover(); this.ownership.leave('overview');
    this.view = 'overview'; this.nodes.hidden = this.footer.hidden = true; this.panel.hidden = false;
    sfx.harbourAmbience(false);
    this.actions.screen(this.view);
    const title = document.createElement('h1'); title.textContent = t('Islands', 'Îles');
    const sub = document.createElement('p'); sub.setAttribute('role', 'status');
    this.heading.replaceChildren(title, sub);
    const back = makeButton(t('‹ Back to the village', '‹ Retour au village'), () => this.show(this.progress!, this.chapter), 'wv-soft');
    this.disposeValley(); this.valleyAssets = new WorldKitAssets();
    this.valley = new ValleyOverview(this.stage, this.progress, this.valleyAssets);
    this.valley.update(this.progress, this.chapter); this.valley.resize();
    this.panel.classList.add('wv-overview-panel');
    this.panel.replaceChildren(back); this.valleyLabels(); this.valley.draw(); this.dirty = false;
    this.panel.querySelector<HTMLButtonElement>('[aria-current="location"]')?.focus({ preventScroll: true });
  }

  private valleyLabels(focusChapter?: number): void {
    if (!this.progress || !this.valley) return;
    const oldList = this.panel.querySelector('.wv-locations');
    const focused = document.activeElement;
    if (focusChapter === undefined && focused instanceof HTMLButtonElement && oldList?.contains(focused)) {
      focusChapter = Number(focused.dataset['chapter']);
    }
    oldList?.remove();
    const list = document.createElement('nav'); list.className = 'wv-locations'; list.setAttribute('aria-label', t('Islands', 'Îles'));
    for (const target of this.valley.targets()) {
      const chapter = this.progress.chapters[target.chapter]!;
      const item = makeButton('', () => this.enterVillage(chapter.index), 'wv-location');
      item.dataset['chapter'] = String(chapter.index); item.setAttribute('aria-disabled', String(!chapter.available));
      item.setAttribute('aria-current', chapter.index === this.chapter ? 'location' : 'false');
      item.style.cssText = `touch-action:none;left:${target.x}px;top:${target.y}px;width:${target.width}px`;
      const name = document.createElement('strong'); name.textContent = worldLocation(chapter.index).name;
      if (!chapter.available) item.prepend(lockIcon());
      else if (chapter.complete) {
        const tick = document.createElement('i'); tick.className = 'wv-island-check'; tick.textContent = '✓'; tick.setAttribute('aria-hidden', 'true'); item.append(tick);
      }
      item.append(name); item.setAttribute('aria-label', `${name.textContent}, ${chapter.available ? constructionCaption(chapter) : t('locked', 'verrouillée')}`);
      list.append(item);
      item.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); this.show(this.progress!, this.chapter); return; }
        const delta = ({ ArrowLeft: -(chapter.index % 2), ArrowRight: 1 - chapter.index % 2, ArrowUp: 2, ArrowDown: -2 } as Record<string, number>)[event.key];
        if (delta === undefined) return;
        event.preventDefault();
        const next = chapter.index + delta;
        if (next === chapter.index || !this.progress!.chapters[next]) return;
        this.valley!.update(this.progress!, next); this.valleyLabels(next); this.valley!.draw();
      });
    }
    this.panel.append(list);
    if (focusChapter !== undefined) {
      const buttons = Array.from(list.querySelectorAll('button'));
      const column = buttons.filter(button => Number(button.dataset['chapter']) % 2 === focusChapter % 2);
      const nearest = column.sort((a, b) =>
        Math.abs(Number(a.dataset['chapter']) - focusChapter) - Math.abs(Number(b.dataset['chapter']) - focusChapter))[0];
      (nearest ?? buttons[0])?.focus({ preventScroll: true });
    }
  }
  private enterVillage(index: number): void {
    const chapter = this.progress?.chapters[index]; if (!chapter) return;
    sfx.unlock();
    if (chapter.available) { this.show(this.progress!, index); return; }
    sfx.blocked();
    this.heading.querySelector('p')!.textContent = t(`Finish ${worldLocation(Math.max(0, index - 1)).name} to open this island.`, `Terminez ${worldLocation(Math.max(0, index - 1)).name} pour ouvrir cette île.`);
  }
  private disposeValley(): void { this.cancelOverviewGesture(); this.draggedLabel = null; this.valley?.dispose(); this.valley = null; this.valleyAssets = null; }

  workshop(levels: readonly GameLevel[], progress: WorldProgress, focusId?: string): void {
    this.disposeValley(); this.panel.classList.remove('wv-overview-panel');
    this.releaseBuildCover(); this.stopFilm(); this.ownership.leave('workshop'); // the retained village, if any, stays behind the panel
    if (!this.scene) this.chapter = Math.max(0, Math.min(Math.floor(Math.min(progress.frontier, Math.max(0, progress.stops.length - 1)) / 10), progress.chapters.length - 1));
    this.progress = progress;
    this.stopFilm(); this.view = 'workshop'; this.element.hidden = false;
    sfx.harbourAmbience(false);
    this.actions.screen(this.view);
    this.heading.hidden = false; this.nodes.hidden = this.viewControls.hidden = true; this.footer.hidden = this.panel.hidden = false;
    const title = document.createElement('h1'); title.textContent = t('The Workshop', 'L’atelier');
    this.heading.replaceChildren(title);
    const back = makeButton(t('‹ Back to the village', '‹ Retour au village'), () => this.actions.map(), 'wv-soft');
    const list = document.createElement('nav'); list.className = 'wv-experiments';
    list.setAttribute('aria-label', t('Workshop puzzles', 'Puzzles de l’atelier'));
    const completed = new Set(completedLevels());
    for (const chapter of progress.chapters) {
      const group = document.createElement('section'); group.className = 'wv-project-group'; group.dataset['chapter'] = String(chapter.index);
      const heading = document.createElement('h2'); heading.textContent = worldLocation(chapter.index).name; group.append(heading);
      for (const project of WORKSHOP_PROJECTS.filter(project => project.chapter === chapter.index)) {
        const index = levels.findIndex(level => level.id === project.id); if (index < 0) continue;
        const level = levels[index]!; const state = projectState(project, progress, completed);
        if (state.status === 'available') this.seenProjects.add(project.id);
        const article = document.createElement('article'); article.className = 'wv-project';
        const item = makeButton('', () => {
          sfx.unlock();
          if (state.status !== 'locked') { this.actions.playWorkshop(index); return; }
          sfx.blocked(); item.querySelector('.wv-project-status')?.classList.add('wv-required');
          window.setTimeout(() => item.querySelector('.wv-project-status')?.classList.remove('wv-required'), 400);
        }, 'wv-experiment'); item.dataset['workshop'] = project.id; item.dataset['status'] = state.status;
        item.setAttribute('aria-disabled', String(state.status === 'locked'));
        const art = document.createElement('span'); art.className = 'wv-project-art';
        const preview = document.createElement('img'); preview.className = 'wv-project-reward'; preview.src = `/models/projects/${project.reward}.png`; preview.width = preview.height = 72; preview.loading = 'lazy'; preview.alt = project.rewardTitle;
        const cue = document.createElement('img'); cue.className = 'wv-project-cue'; cue.src = `/models/projects/cues/${project.id}.png`; cue.width = cue.height = 64; cue.loading = 'lazy'; cue.alt = '';
        art.append(preview, cue);
        const copy = document.createElement('span'); copy.className = 'wv-project-copy';
        const name = document.createElement('strong'); name.textContent = project.title;
        const game = document.createElement('span'); game.textContent = level.name;
        const status = document.createElement('small'); status.className = 'wv-project-status';
        if (state.status === 'locked') {
          status.append(lockIcon(), t(`${state.built}/${state.required} stops built`, `${state.built}/${state.required} étapes construites`));
          item.setAttribute('aria-label', `${project.title}, ${state.label}`);
        } else status.textContent = state.status === 'completed' ? t('Built', 'Construit') : t('Ready to build', 'À construire');
        copy.append(name, game, status); item.append(art, copy); article.append(item);
        if (state.status === 'completed') {
          const check = document.createElement('b'); check.className = 'wv-workshop-check'; check.textContent = '✓'; check.setAttribute('aria-hidden', 'true'); status.prepend(check);
          item.setAttribute('aria-label', `${project.title}, ${t('completed', 'terminé')}`);
          const visit = makeButton(t('View village', 'Voir le village'), () => this.actions.projectVillage(project.chapter), 'wv-project-visit'); visit.dataset['projectVillage'] = project.id; article.append(visit);
        }
        group.append(article);
      }
      if (group.querySelector('article')) list.append(group);
    }
    this.footer.classList.add('wv-workshop-footer');
    this.footer.replaceChildren(back); this.panel.replaceChildren(list); this.panel.scrollTop = 0;
    this.dirty = true; if (!this.scene) this.drawBlank();
    if (focusId) this.panel.querySelector<HTMLButtonElement>(`[data-workshop="${focusId}"]`)?.focus({ preventScroll: false });
    else if (this.chapter > 0) this.panel.querySelector<HTMLElement>(`.wv-project-group[data-chapter="${this.chapter}"]`)?.scrollIntoView({ block: 'start' });
  }

  playFilm(chapter: number, earned = false): void {
    this.clearMapPointers();this.viewControls.hidden=true;this.cover();
    this.filmFinished=false;
    this.releaseBuildCover();
    if (!this.progress?.chapters[chapter]?.complete) return;
    this.stopFilm(); this.view = 'film'; this.filmIndex = chapter; this.element.hidden = false;
    this.earnedFilm = earned;
    sfx.harbourAmbience(true, this.filmIndex);
    this.actions.screen(this.view);
    this.heading.hidden = this.nodes.hidden = this.panel.hidden = this.footer.hidden = true;
    this.filmControls.hidden = false;
    const label = document.createElement('span'); label.textContent = worldLocation(chapter).creation;
    const skip = makeButton(t('Back to map', 'Retour à la carte'), () => this.finishFilm(), 'wv-soft'); skip.id = 'film-skip';
    this.filmControls.replaceChildren(label, skip);
    this.ownership.openFilm(chapter, earned); // borrows the map scene or builds it
    this.filmTime = 0; this.playing = false; this.filmWait = 'waiting'; this.dirty = true;
    this.filmStatus(t('Getting the machine ready…', 'Préparation de la machine…'), 'waiting');
    if (this.scene?.chapter !== chapter) this.drawBlank();
    this.filmBuilt();
    skip.focus({ preventScroll: true });
  }
  /** Film screen: create the playback once its scene is built; until then the
   *  current scene's first framing (when built) under the same status line. */
  private filmBuilt(): void {
    if (this.view !== 'film' || this.filmWait !== 'waiting') return;
    if (this.ownership.filmFailed()) { this.filmFailed(); return; }
    if (!this.playback) {
      const scenes = this.ownership.filmScenes();
      if (!scenes) {
        const scene = this.scene;
        if (scene?.chapter === this.filmIndex) { scene.resize(); scene.finishConstruction(); scene.filmPoster(!this.reduced.matches); }
        return;
      }
      scenes.current.resize();
      this.playback = new WorldFilm(this.stage, this.filmIndex, scenes.current);
      this.dirty = true;
    }
    this.startWhenReady();this.reveal();
  }
  /** Motion starts only when every scene is ready for its selected playback model, and only
   *  while this same film screen is still open. */
  private startWhenReady(): boolean {
    const playback = this.playback;
    if (!playback || this.filmWait !== 'waiting') return false;
    const readiness = playback.readiness();
    if (readiness === 'pending') {
      if (!this.dirty) return false;
      this.dirty = false; playback.poster(!this.reduced.matches); return true;
    }
    if (readiness === 'failed' || !playback.begin()) { this.filmFailed(); playback.poster(!this.reduced.matches); return true; }
    this.filmWait = 'ready'; this.dirty = false; this.filmStatus(null, 'ready');
    this.stage.canvas.dataset['worldPlayback'] = 'realtime-3d';
    playback.render(0, !this.reduced.matches);
    const play = (): void => {
      if (this.playback !== playback) return;
      this.playing = true; this.filmControls.querySelector('.wv-film-button')?.remove();
    };
    if (this.reduced.matches) this.filmControls.prepend(makeButton(t('Play film', 'Lire le film'), () => { sfx.unlock(); play(); }, 'wv-film-button'));
    else play();
    return true;
  }
  private filmFailed(): void { this.filmWait = 'failed'; this.dirty = false; this.filmStatus(t('This machine can’t play right now.', 'Cette machine ne peut pas être lancée pour l’instant.'), 'unavailable'); }
  private filmStatus(text: string | null, state: 'waiting' | 'unavailable' | 'ready'): void {
    if (this.stage.canvas.dataset['worldFilm'] !== state) this.stage.canvas.dataset['worldFilm'] = state;
    if (text === null) { this.filmNote.remove(); return; }
    if (this.filmNote.textContent !== text) this.filmNote.textContent = text;
    if (!this.filmNote.isConnected) this.filmControls.append(this.filmNote);
  }
  private finishFilm(): void {
    if (this.view !== 'film'||this.filmFinished) return;
    this.filmFinished=true;
    const chapter = this.filmIndex, earned = this.earnedFilm;
    this.cover();
    this.stopFilm(); this.actions.filmDone(chapter, earned);
  }
  private stopFilm(): void {
    this.playback?.dispose(); this.playback = null; this.playing = false; this.filmTime = 0; this.filmWait = 'ready';
    this.ownership.endFilm(); // the film's own handoff scene/build goes; the borrowed map scene stays
    this.scene?.stopFilm(); this.filmNote.remove();
    delete this.stage.canvas.dataset['worldPlayback']; delete this.stage.canvas.dataset['worldFilm']; this.filmControls.hidden = true;
  }
  hide(): void { sfx.harbourAmbience(false); this.releaseBuildCover(); this.stopFilm(); this.ownership.leave('hidden'); this.disposeValley(); this.clearMapPointers(); this.element.hidden = true; }
  resize(): void { this.scene?.resize(); this.valley?.resize(); this.playback?.resize(); if (this.view === 'overview') this.valleyLabels(); else this.positions(); this.dirty = true; }
  private positions(): void {
    const pins = this.scene?.targets() ?? [];
    const width = this.stage.canvas.clientWidth, height = this.stage.canvas.clientHeight;
    pins.forEach((point, index) => {
      const button = this.nodes.children.item(index);
      if (!(button instanceof HTMLElement)) return;
      button.hidden = point.x < 22 || point.x > width - 22 || point.y < 115 || point.y > height - 145;
      button.style.left = `${point.x}px`; button.style.top = `${point.y}px`;
    });
  }
  advance(seconds: number): boolean {
    if (this.element.hidden) return false;
    if (this.view === 'film') {
      if (!this.playback || document.hidden) return false;
      if (this.filmWait === 'waiting') return this.startWhenReady();
      if (this.filmWait === 'failed') { if (!this.dirty) return false; this.dirty = false; this.playback.poster(!this.reduced.matches); return true; }
      if (!this.playing) {
        if (!this.dirty) return false;
        this.dirty = false;
        this.scene?.stepSea(seconds,this.reduced.matches);this.playback.render(this.filmTime, !this.reduced.matches); return true;
      }
      this.dirty = false;
      const strike = this.playback.bellStrike;
      const previous = this.filmTime;
      this.filmTime += seconds;
      for (const cue of this.playback.routeCues) {
        if (previous < cue.at && this.filmTime >= cue.at) sfx.harbourRouteCue(cue.cue);
      }
      if (strike !== undefined && previous < strike && this.filmTime >= strike) sfx.harbourBell();
      if (this.filmTime >= this.playback.duration) {
        // The run came home: paper over the map it returns to. A skipped film ends quietly.
        this.finishFilm(); confetti(); return false;
      }
      this.scene?.stepSea(seconds,this.reduced.matches);this.playback.render(this.filmTime, !this.reduced.matches); return true;
    }
    if (this.view === 'overview') { if (!this.dirty) return false; this.dirty = false; this.valley?.draw(); return true; }
    if (!this.scene) return false;
    const moving = this.view === 'map' && this.scene.advance(seconds);
    const harbour = this.view === 'map' && this.scene.hasVillageLife && !this.reduced.matches && !document.hidden;
    if (harbour) this.harbourFrame += seconds;
    if (!moving && !this.dirty && !(harbour && this.harbourFrame >= 1 / 20)) return false;
    this.dirty = false;
    this.scene.stepSea(harbour ? this.harbourFrame : seconds, this.reduced.matches);
    this.harbourFrame = 0;
    this.scene.draw();
    return true;
  }

  /** One boundary snapshot fades after the new scene is ready; no second renderer runs alongside play. */
  cover(): void {
    this.holdBuildCover = false; this.curtain.classList.remove('wv-building');
    if (!this.curtain.hidden && this.curtain.style.opacity === '1') return;
    window.clearTimeout(this.transitionTimer); cancelAnimationFrame(this.transitionFrame);
    if (this.reduced.matches) { this.curtain.hidden = true; return; }
    if (!this.element.hidden && this.view !== 'film') { if (this.view === 'overview') this.valley?.draw(); else this.scene?.draw(); }
    this.curtain.width = this.stage.canvas.width; this.curtain.height = this.stage.canvas.height;
    const context = this.curtain.getContext('2d');
    context?.drawImage(this.stage.canvas, 0, 0);
    this.curtain.style.opacity = '1'; this.curtain.hidden = false;
    void this.curtain.offsetWidth;
  }
  reveal(): void {
    if (this.holdBuildCover || this.curtain.hidden) return;
    window.clearTimeout(this.transitionTimer); cancelAnimationFrame(this.transitionFrame);
    this.transitionFrame = requestAnimationFrame(() => {
      this.curtain.style.opacity = '0';
      this.transitionTimer = window.setTimeout(() => {
        if (this.curtain.style.opacity !== '0') return;
        this.curtain.hidden = true; this.curtain.width = this.curtain.height = 1; this.curtain.classList.remove('wv-building');
      }, 280);
    });
  }
  get currentChapter(): number { return this.view === 'film' ? this.filmIndex : this.chapter; }
  get mode(): string { return this.view; }

  private mapChanged(): void {
    this.scene?.inspect();this.positions();this.dirty=true;this.resetView.hidden=!this.scene?.orbit.changed;
  }
  private clearMapPointers():void {
    for(const id of this.mapPointers.keys())if(this.stage.canvas.hasPointerCapture(id))this.stage.canvas.releasePointerCapture(id);
    this.mapPointers.clear();this.mapMoved=false;this.element.classList.remove('wv-inspecting');
  }
  private cancelOverviewGesture(): void {
    const gesture = this.gesture;
    if (!gesture) return;
    this.gesture = null;
    this.draggedLabel = gesture.target;
    if (gesture.target.hasPointerCapture(gesture.id)) gesture.target.releasePointerCapture(gesture.id);
    if (gesture.focus === document.body && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    else if (gesture.focus?.isConnected) gesture.focus.focus({ preventScroll: true });
  }
  private bindWorldPointer(): void {
    const canvas = this.stage.canvas;
    const mapTarget=(target:EventTarget|null):boolean=>target===canvas||target instanceof Element&&!!target.closest('.map-stop');
    document.addEventListener('pointerdown',event=>{
      if(this.element.hidden||this.view!=='map'||!this.scene||!this.curtain.hidden||!mapTarget(event.target)||event.button!==0)return;
      if(!this.mapPointers.size){this.suppressMapClick=false;this.mapMoved=false;}
      this.mapPointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY});
      if(this.mapPointers.size>1){this.mapMoved=true;this.suppressMapClick=true;this.element.classList.add('wv-inspecting');}
    },true);
    document.addEventListener('pointermove',event=>{
      const p=this.mapPointers.get(event.pointerId);if(!p||this.view!=='map'||!this.scene)return;
      const dx=event.clientX-p.x,dy=event.clientY-p.y;
      const pointers=[...this.mapPointers.values()],other=pointers.find(q=>q!==p);
      const before=other?Math.hypot(p.x-other.x,p.y-other.y):0;
      p.x=event.clientX;p.y=event.clientY;
      if(!this.mapMoved&&Math.hypot(p.x-p.startX,p.y-p.startY)<9)return;
      this.mapMoved=true;this.suppressMapClick=true;this.element.classList.add('wv-inspecting');
      if(!canvas.hasPointerCapture(event.pointerId))canvas.setPointerCapture(event.pointerId);
      if(other){
        const after=Math.hypot(p.x-other.x,p.y-other.y);
        if(before>1&&after>1)this.scene.orbit.magnify(after/before);
        this.scene.orbit.move(dx/2,dy/2,canvas.clientHeight);
      }else if(event.shiftKey)this.scene.orbit.move(dx,dy,canvas.clientHeight);
      else this.scene.orbit.rotate(dx,dy);
      this.mapChanged();event.preventDefault();
    },{capture:true,passive:false});
    const releaseMap=(event:PointerEvent):void=>{
      if(!this.mapPointers.has(event.pointerId))return;
      this.mapPointers.delete(event.pointerId);
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      // The remaining finger starts a fresh one-finger drag, with no pinch-to-orbit jump.
      for(const p of this.mapPointers.values()){p.startX=p.x;p.startY=p.y;}
      if(!this.mapPointers.size){this.mapMoved=false;this.element.classList.remove('wv-inspecting');this.positions();}
    };
    document.addEventListener('pointerup',releaseMap,true);document.addEventListener('pointercancel',releaseMap,true);
    document.addEventListener('click',event=>{
      if(this.suppressMapClick&&mapTarget(event.target)){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    const cancelPointers = (): void => { this.clearMapPointers(); this.cancelOverviewGesture(); };
    window.addEventListener('blur', cancelPointers);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelPointers(); });
    const overviewTarget = (target: EventTarget | null): HTMLElement | null => {
      if (target === canvas) return canvas;
      return target instanceof Element ? target.closest<HTMLButtonElement>('.wv-location') : null;
    };
    document.addEventListener('pointerdown', event => {
      const target = overviewTarget(event.target);
      if (!target || this.view !== 'overview' || this.element.hidden || event.button !== 0 || this.gesture) return;
      this.draggedLabel = null;
      this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, target,
        focus: document.activeElement instanceof HTMLElement ? document.activeElement : null };
      target.setPointerCapture(event.pointerId);
    }, true);
    document.addEventListener('pointermove', event => {
      const gesture = this.gesture;
      if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 9) gesture.moved = true;
    }, true);
    const pan = (delta: number): void => {
      if (this.valley?.panRows(Math.sign(delta))) { this.valleyLabels(); this.dirty = true; }
    };
    document.addEventListener('pointerup', event => {
      const gesture = this.gesture;
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (gesture.moved || Math.hypot(dx, dy) >= 9) {
        this.cancelOverviewGesture();
        if (Math.abs(dy) >= 30 && Math.abs(dy) > Math.abs(dx)) pan(dy);
        return;
      }
      this.gesture = null;
      if (gesture.target === canvas) {
        const hit = this.valley?.pick(event.clientX, event.clientY);
        if (hit !== null && hit !== undefined) this.enterVillage(hit);
      }
      // The browser releases capture and activates a tapped label with its native click.
    }, true);
    const cancelled = (event: PointerEvent): void => {
      if (this.gesture?.id === event.pointerId) this.cancelOverviewGesture();
    };
    document.addEventListener('pointercancel', cancelled, true);
    document.addEventListener('lostpointercapture', cancelled, true);
    document.addEventListener('click', event => {
      if (event.detail && this.draggedLabel && this.draggedLabel.contains(event.target as Node)) {
        event.preventDefault(); event.stopImmediatePropagation();
        this.draggedLabel = null;
      }
    }, true);
    document.addEventListener('wheel', event => {
      if (this.element.hidden) return;
      if (event.target === canvas && this.view === 'map' && this.scene) {
        event.preventDefault(); this.scene.orbit.magnify(Math.exp(-event.deltaY * .001)); this.mapChanged();
      } else if (this.view === 'overview' && overviewTarget(event.target)) {
        event.preventDefault();
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) pan(-event.deltaY);
      }
    }, { passive: false });
    document.addEventListener('keydown',event=>{
      if(this.element.hidden||this.view!=='map'||!this.scene||!this.panel.hidden||!this.curtain.hidden)return;
      if(event.target instanceof HTMLElement&&event.target.closest('#levels,input,textarea,select'))return;
      const orbit=this.scene.orbit;
      switch(event.key){
        case 'ArrowLeft':orbit.rotate(-12,0);break;case 'ArrowRight':orbit.rotate(12,0);break;
        case 'ArrowUp':orbit.rotate(0,-8);break;case 'ArrowDown':orbit.rotate(0,8);break;
        case '+':case '=':orbit.magnify(1.15);break;case '-':orbit.magnify(1/1.15);break;
        case 'Home':orbit.reset();break;default:return;
      }
      event.preventDefault();this.mapChanged();
    });
  }
}

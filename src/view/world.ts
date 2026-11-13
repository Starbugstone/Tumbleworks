import * as THREE from 'three';
import { confetti } from './confetti';
import { DEEP_SEA } from '../engine/stage';
import type { Stage } from '../engine/stage';
import type { GameLevel } from '../engine/contracts';
import { t } from '../i18n';
import { worldLocation } from '../world/locations';
import type { WorldProgress } from '../world/progression';
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

/** Map controls live in the DOM; its miniature shares the game's renderer and rests between interactions. */
export class WorldView {
  readonly element = document.createElement('section');
  private readonly heading = document.createElement('header');
  private readonly nodes = document.createElement('nav');
  private readonly workshopMarker = document.createElement('button');
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
  private playing = false;
  private valley: ValleyOverview | null = null;
  private valleyAssets: WorldKitAssets | null = null;
  private gesture: { id: number; x: number; y: number; moved: boolean } | null = null;
  private spring = 0;
  private springYaw = 0;
  private yaw = 0;
  private filmIndex = 0;
  private transitionTimer = 0;
  private transitionFrame = 0;
  private earnedFilm = false;
  private readonly seenProjects = new Set<string>();
  private projectNoticeInitialized = false;

  constructor(private readonly stage: Stage, private readonly actions: WorldActions) {
    this.element.id = 'world'; this.element.hidden = true;
    this.nodes.id = 'world-stops'; this.nodes.setAttribute('aria-label', t('Construction stops', 'Étapes de construction'));
    this.heading.className = 'wv-heading'; this.footer.className = 'wv-footer';
    this.panel.className = 'wv-panel'; this.panel.hidden = true;
    this.filmControls.className = 'wv-film-controls'; this.filmControls.hidden = true;
    this.filmNote.className = 'wv-film-status'; this.filmNote.setAttribute('role', 'status');
    this.blankScene.background = new THREE.Color(DEEP_SEA);
    this.ownership = new VillageOwnership(chapter => new SceneBuild(chapter, this.stage, {motion:'cinematic'}), () => this.built());
    this.workshopMarker.type = 'button'; this.workshopMarker.className = 'map-workshop'; this.workshopMarker.hidden = true;
    this.workshopMarker.dataset['worldWorkshop'] = '';
    this.workshopMarker.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="currentColor" transform="rotate(-35 12 12)"><rect x="5" y="3" width="14" height="6" rx="1.2"/><rect x="10" y="8" width="4" height="13" rx="1.1"/></g></svg><i class="map-stem" aria-hidden="true"></i>';
    this.workshopMarker.addEventListener('click', () => this.actions.workshop());
    this.element.append(this.heading, this.nodes, this.workshopMarker, this.panel, this.footer, this.filmControls);
    document.getElementById('hud')!.prepend(this.element);
    this.curtain.id = 'journey-transition'; this.curtain.hidden = true; this.curtain.setAttribute('aria-hidden', 'true'); document.body.append(this.curtain);
    this.bindWorldPointer();
  }

  show(progress: WorldProgress, chapter: number, construct = false): void {
    const fromMap = this.view === 'map' && !this.element.hidden;
    this.disposeValley();
    this.stopFilm(); this.progress = progress;
    this.panel.classList.remove('wv-overview-panel'); this.spring = this.yaw = 0;
    this.chapter = Math.max(0, Math.min(chapter, progress.chapters.length - 1));
    this.view = 'map'; this.element.hidden = false; this.panel.hidden = true;
    this.workshopMarker.hidden = false; this.workshopMarker.setAttribute('aria-label', t('Workshop', 'Atelier'));
    this.workshopMarker.querySelector('.wv-project-notice')?.remove(); this.workshopMarker.removeAttribute('aria-description');
    this.actions.screen(this.view);
    this.heading.hidden = this.nodes.hidden = this.footer.hidden = false;
    const current = progress.chapters[this.chapter];
    // Switching villages: the old view stays, dimmed, until the new one is drawn (reduced motion: plain backdrop).
    if (fromMap && this.scene && this.scene.chapter !== this.chapter && !this.reduced.matches) { this.cover(); this.holdBuildCover = true; this.curtain.classList.add('wv-building'); this.curtain.style.opacity = '0.4'; }
    this.pendingConstruct = construct && !this.reduced.matches;
    if (current && this.scene?.chapter === this.chapter) this.scene.update(current, this.pendingConstruct);
    this.ownership.showMap(this.chapter); // retained: activates its proof after update; else builds
    this.stage.canvas.dataset['worldScene'] = this.scene ? 'ready' : 'building';
    if (!current) return;
    const location = worldLocation(this.chapter);
    const done = current.stops.filter(stop => stop.status === 'built').length;
    const title = document.createElement('h1'); title.textContent = location.name;
    const subtitle = document.createElement('p'); subtitle.textContent = this.scene ? `${location.creation} · ${done}/${current.stops.length}` : t('Getting the village ready…', 'Préparation du village…');
    if (!this.scene) subtitle.setAttribute('role', 'status');
    this.heading.replaceChildren(title, subtitle);
    this.nodes.replaceChildren(...current.stops.map(stop => {
      const button = makeButton(stop.status === 'built' ? '✓' : String(stop.local + 1), () => this.actions.enter(stop.index), 'map-stop');
      button.dataset['round'] = String(stop.index); button.dataset['status'] = stop.status;
      button.disabled = stop.status === 'locked';
      button.setAttribute('aria-label', t(`Construction stop ${stop.index + 1}, ${stop.completed} of 3 puzzles completed${stop.status === 'locked' ? ', locked' : ''}`, `Étape de construction ${stop.index + 1}, ${stop.completed} puzzles sur 3 terminés${stop.status === 'locked' ? ', verrouillée' : ''}`));
      button.setAttribute('aria-current', stop.index === progress.frontier ? 'step' : 'false');
      const dots = document.createElement('span'); dots.className = 'map-dots'; dots.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 3; i++) { const dot = document.createElement('i'); dot.classList.toggle('done', i < stop.completed); dots.append(dot); }
      const stem = document.createElement('i'); stem.className = 'map-stem'; stem.setAttribute('aria-hidden', 'true');
      button.append(stem, dots); return button;
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
    const atelier = makeButton(t('Workshop', 'Atelier'), () => this.actions.workshop(), 'wv-soft'); atelier.id = 'world-workshop';
    const completed = new Set(completedLevels());
    const available = WORKSHOP_PROJECTS.filter(project => projectState(project, progress, completed).status === 'available');
    if (!this.projectNoticeInitialized) { available.forEach(project => this.seenProjects.add(project.id)); this.projectNoticeInitialized = true; }
    if (available.some(project => !this.seenProjects.has(project.id))) {
      for (const entry of [atelier, this.workshopMarker]) {
        const dot = document.createElement('i'); dot.className = 'wv-project-notice'; dot.setAttribute('aria-hidden', 'true'); entry.append(dot);
        entry.setAttribute('aria-description', t('A new village project is available.', 'Un nouveau projet de village est disponible.'));
      }
    }
    nav.append(previous, makeButton(t('The valley', 'La vallée'), () => this.overview(), 'wv-soft'), atelier, next);
    this.footer.replaceChildren(primary, nav);
    this.nodes.hidden = this.workshopMarker.hidden = !this.scene;
    this.positions(); this.dirty = true;
    if (this.scene) this.scene.draw(); else this.drawBlank();
  }
  /** A build settled: a map scene, or a film's previous scene. Called before its proof is activated. */
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
    scene.resize(); scene.update(current, this.pendingConstruct);
    if (subtitle) { subtitle.removeAttribute('role'); subtitle.textContent = `${worldLocation(this.chapter).creation} · ${current.stops.filter(stop => stop.status === 'built').length}/${current.stops.length}`; }
    this.nodes.hidden = this.workshopMarker.hidden = false; this.stage.canvas.dataset['worldScene'] = 'ready';
    this.positions(); this.dirty = true; scene.draw(); this.releaseBuildCover(); this.reveal();
  }
  private drawBlank(): void { this.stage.draw(this.blankScene, this.blankCamera); }
  private releaseBuildCover(): void { const held = this.holdBuildCover; this.holdBuildCover = false; if (held) this.reveal(); }

  private overview(): void {
    if (!this.progress) return;
    this.releaseBuildCover(); this.ownership.leave('overview');
    this.view = 'overview'; this.nodes.hidden = this.footer.hidden = true; this.panel.hidden = false;
    this.workshopMarker.hidden = true;
    this.actions.screen(this.view);
    const title = document.createElement('h1'); title.textContent = t('The Valley Run', 'La grande traversée');
    const sub = document.createElement('p'); sub.textContent = t('One valley. One wonderfully unlikely machine.', 'Une vallée. Une machine merveilleusement improbable.');
    this.heading.replaceChildren(title, sub);
    const back = makeButton(t('‹ Back to the village', '‹ Retour au village'), () => this.show(this.progress!, this.chapter), 'wv-soft');
    this.disposeValley(); this.valleyAssets = new WorldKitAssets();
    this.valley = new ValleyOverview(this.stage, this.progress, this.valleyAssets);
    this.valley.update(this.progress, this.chapter); this.valley.resize();
    this.panel.classList.add('wv-overview-panel');
    this.panel.replaceChildren(back); this.valleyLabels(); this.valley.draw(); this.dirty = false;
    this.panel.querySelector<HTMLButtonElement>('[aria-current="location"]')?.focus({ preventScroll: true });
  }

  private valleyLabels(): void {
    if (!this.progress || !this.valley) return;
    this.panel.querySelector('.wv-locations')?.remove();
    const list = document.createElement('nav'); list.className = 'wv-locations'; list.setAttribute('aria-label', t('Valley locations', 'Lieux de la vallée'));
    for (const target of this.valley.targets()) {
      const chapter = this.progress.chapters[target.chapter]!;
      const item = makeButton('', () => this.enterVillage(chapter.index), 'wv-location');
      item.dataset['chapter'] = String(chapter.index); item.setAttribute('aria-disabled', String(!chapter.available));
      item.setAttribute('aria-current', chapter.index === this.chapter ? 'location' : 'false');
      item.style.cssText = `left:${target.x}px;top:${target.y}px;width:${target.width}px`;
      const name = document.createElement('strong'); name.textContent = `${chapter.complete ? '✓ ' : ''}${worldLocation(chapter.index).name}`;
      const count = document.createElement('small'); count.textContent = `${chapter.stops.filter(stop => stop.status === 'built').length}/${chapter.stops.length}`;
      item.append(name, count); list.append(item);
      item.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); this.show(this.progress!, this.chapter); return; }
        const delta = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 } as Record<string, number>)[event.key];
        if (delta === undefined) return;
        event.preventDefault(); const next = Math.max(0, Math.min(chapter.index + delta, this.progress!.chapters.length - 1));
        this.valley!.update(this.progress!, next); this.valleyLabels(); this.valley!.draw();
        this.panel.querySelector<HTMLButtonElement>(`[data-chapter="${next}"]`)?.focus({ preventScroll: true });
      });
    }
    this.panel.append(list);
  }
  private enterVillage(index: number): void {
    const chapter = this.progress?.chapters[index]; if (!chapter) return;
    sfx.unlock();
    if (chapter.available) { this.show(this.progress!, index); return; }
    sfx.blocked();
    this.heading.querySelector('p')!.textContent = t(`Finish ${worldLocation(Math.max(0, index - 1)).name} to open this village.`, `Terminez ${worldLocation(Math.max(0, index - 1)).name} pour ouvrir ce village.`);
  }
  private disposeValley(): void { this.valley?.dispose(); this.valley = null; this.valleyAssets = null; }

  workshop(levels: readonly GameLevel[], progress: WorldProgress, focusId?: string): void {
    this.disposeValley(); this.panel.classList.remove('wv-overview-panel');
    this.releaseBuildCover(); this.stopFilm(); this.ownership.leave('workshop'); // the retained village, if any, stays behind the panel
    if (!this.scene) this.chapter = Math.max(0, Math.min(Math.floor(Math.min(progress.frontier, Math.max(0, progress.stops.length - 1)) / 10), progress.chapters.length - 1));
    this.progress = progress;
    this.stopFilm(); this.view = 'workshop'; this.element.hidden = false;
    this.workshopMarker.hidden = true;
    this.actions.screen(this.view);
    this.heading.hidden = false; this.nodes.hidden = this.footer.hidden = true; this.panel.hidden = false;
    const title = document.createElement('h1'); title.textContent = t('The Workshop', 'L’atelier');
    const sub = document.createElement('p'); sub.textContent = t('Optional projects for your villages.', 'Des projets facultatifs pour vos villages.');
    this.heading.replaceChildren(title, sub);
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
        const status = document.createElement('small'); status.className = 'wv-project-status'; status.textContent = `${state.status === 'completed' ? '✓' : '⚑'} ${state.label}`;
        copy.append(name, game, status); item.append(art, copy); article.append(item);
        if (state.status === 'completed') {
          const check = document.createElement('b'); check.className = 'wv-workshop-check'; check.textContent = '✓'; check.setAttribute('aria-hidden', 'true'); item.append(check);
          item.setAttribute('aria-label', `${project.title}, ${t('completed', 'terminé')}`);
          const visit = makeButton(t('View village', 'Voir le village'), () => this.actions.projectVillage(project.chapter), 'wv-project-visit'); visit.dataset['projectVillage'] = project.id; article.append(visit);
        }
        group.append(article);
      }
      list.append(group);
    }
    this.panel.replaceChildren(back, list); this.dirty = true; if (!this.scene) this.drawBlank();
    if (focusId) this.panel.querySelector<HTMLButtonElement>(`[data-workshop="${focusId}"]`)?.focus({ preventScroll: false });
    else this.panel.querySelector<HTMLElement>(`.wv-project-group[data-chapter="${this.chapter}"]`)?.scrollIntoView({ block: 'start' });
  }

  playFilm(chapter: number, earned = false): void {
    this.filmFinished=false;
    this.releaseBuildCover();
    if (!this.progress?.chapters[chapter]?.complete) return;
    this.stopFilm(); this.view = 'film'; this.filmIndex = chapter; this.element.hidden = false;
    this.workshopMarker.hidden = true;
    this.earnedFilm = earned;
    this.actions.screen(this.view);
    this.heading.hidden = this.nodes.hidden = this.panel.hidden = this.footer.hidden = true;
    this.filmControls.hidden = false;
    const label = document.createElement('span'); label.textContent = worldLocation(chapter).creation;
    const skip = makeButton(t('Back to map', 'Retour à la carte'), () => this.finishFilm(), 'wv-soft'); skip.id = 'film-skip';
    this.filmControls.replaceChildren(label, skip);
    this.ownership.openFilm(chapter, earned); // borrows the map scene or builds it, then builds the handoff scene
    this.filmTime = 0; this.playing = false; this.filmWait = 'waiting'; this.dirty = true;
    this.filmStatus(t('Getting the machine ready…', 'Préparation de la machine…'), 'waiting');
    if (this.scene?.chapter !== chapter) this.drawBlank();
    this.filmBuilt();
    skip.focus({ preventScroll: true });
  }
  /** Film screen: create the playback once both scenes it renders are built; until then the
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
      this.playback = new WorldFilm(this.stage, this.filmIndex, scenes.current, scenes.previous);
      this.dirty = true;
    }
    this.startWhenReady();
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
    if (this.reduced.matches) this.filmControls.prepend(makeButton(t('Play film', 'Lire le film'), play, 'wv-film-button'));
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
  hide(): void { this.releaseBuildCover(); this.stopFilm(); this.ownership.leave('hidden'); this.disposeValley(); this.gesture = null; this.spring = 0; this.element.hidden = true; }
  resize(): void { this.scene?.resize(); this.valley?.resize(); this.playback?.resize(); if (this.view === 'overview') this.valleyLabels(); else this.positions(); this.dirty = true; }
  private positions(): void {
    this.scene?.targets().forEach((point, index) => {
      const button = this.nodes.children.item(index);
      if (button instanceof HTMLElement) {
        button.style.left = `${point.x}px`; button.style.top = `${point.y}px`;
        const ground = this.scene!.groundTargets()[index]!;
        const stem = button.querySelector<HTMLElement>('.map-stem');
        if (stem) { stem.style.width = `${Math.hypot(ground.x - point.x, ground.y - point.y)}px`; stem.style.transform = `rotate(${Math.atan2(ground.y - point.y, ground.x - point.x)}rad)`; }
      }
    });
    const workshop = this.scene?.workshopTargets();
    if (workshop) {
      this.workshopMarker.style.left = `${workshop.badge.x}px`; this.workshopMarker.style.top = `${workshop.badge.y}px`;
      const stem = this.workshopMarker.querySelector<HTMLElement>('.map-stem')!;
      stem.style.width = `${Math.hypot(workshop.door.x - workshop.badge.x, workshop.door.y - workshop.badge.y)}px`;
      stem.style.transform = `rotate(${Math.atan2(workshop.door.y - workshop.badge.y, workshop.door.x - workshop.badge.x)}rad)`;
    }
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
        this.playback.render(this.filmTime, !this.reduced.matches); return true;
      }
      this.dirty = false;
      this.filmTime += seconds;
      if (this.filmTime >= this.playback.duration) {
        // The run came home: paper over the map it returns to. A skipped film ends quietly.
        this.finishFilm(); confetti(); return false;
      }
      this.playback.render(this.filmTime, !this.reduced.matches); return true;
    }
    if (this.view === 'overview') { if (!this.dirty) return false; this.dirty = false; this.valley?.draw(); return true; }
    if (!this.scene) return false;
    if (this.spring > 0) {
      this.spring = Math.max(0, this.spring - seconds);
      this.yaw = this.springYaw * (this.spring / 0.35) ** 3;
      this.scene.setYaw(this.yaw); this.positions(); this.dirty = true;
    }
    const moving = this.view === 'map' && this.scene.advance(seconds);
    if (!moving && !this.dirty) return false;
    this.dirty = false; this.scene.draw(); return true;
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
  get currentChapter(): number { return this.chapter; }
  get mode(): string { return this.view; }

  private bindWorldPointer(): void {
    const canvas = this.stage.canvas;
    canvas.addEventListener('pointerdown', event => {
      if (this.element.hidden || !['map', 'overview'].includes(this.view) || event.button !== 0 || this.gesture) return;
      this.spring = 0; this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      const gesture = this.gesture; if (!gesture || gesture.id !== event.pointerId) return;
      const delta = event.clientX - gesture.x;
      if (this.view === 'map' && Math.abs(delta) >= 10) {
        gesture.moved = true; this.yaw = Math.max(-Math.PI / 12, Math.min(Math.PI / 12, delta / 220));
        this.scene?.setYaw(this.yaw); this.positions(); this.dirty = true;
      } else if (this.view === 'overview' && Math.abs(event.clientY - gesture.y) >= 30) gesture.moved = true;
    });
    const release = (event: PointerEvent): void => {
      const gesture = this.gesture; if (!gesture || gesture.id !== event.pointerId) return;
      this.gesture = null;
      if (this.view === 'map' && gesture.moved) {
        this.springYaw = this.yaw; this.spring = this.reduced.matches ? 0 : 0.35;
        if (this.reduced.matches) { this.yaw = 0; this.scene?.setYaw(0); this.positions(); this.dirty = true; }
      } else if (this.view === 'overview') {
        if (gesture.moved && this.valley?.panRows(Math.sign(gesture.y - event.clientY))) { this.valleyLabels(); this.dirty = true; }
        else if (!gesture.moved && event.type === 'pointerup') { const hit = this.valley?.pick(event.clientX, event.clientY); if (hit !== null && hit !== undefined) this.enterVillage(hit); }
      }
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('wheel', event => {
      if (this.view !== 'overview' || this.element.hidden) return;
      event.preventDefault(); if (this.valley?.panRows(Math.sign(event.deltaY))) { this.valleyLabels(); this.dirty = true; }
    }, { passive: false });
  }
}

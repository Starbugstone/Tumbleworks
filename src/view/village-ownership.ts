// Who owns which village scene, build and proof, by screen. Pure lifecycle: no DOM, no
// rendering, generic over the scene so the same class is model-checked in Node and runs
// in WorldView. WorldView keeps every DOM, camera and drawing decision.
//
// Rule (root128): leaving the village for gameplay, another village, the Workshop or the
// valley stops unfinished construction and proof. A built map scene is retained across
// gameplay, Workshop, valley and film; returning re-activates it, which starts a FRESH
// proof generation only if no certificate was completed. No cross-scene accepted work.

export interface LifecycleScene {
  readonly chapter: number;
  /** Map or film now shows this scene: its proof may run while it is eligible. */
  activateProof(): void;
  /** Not shown: unfinished proof work stops; completed certificate kept. */
  suspendProof(): void;
  dispose(): void;
}
export interface LifecycleBuild<S> {
  readonly chapter: number;
  readonly state: 'running' | 'done' | 'failed' | 'cancelled';
  take(): S;
  cancel(): void;
  onSettled(listener: () => void): void;
}
export type VillageScreen = 'map' | 'film' | 'overview' | 'workshop' | 'hidden';
export interface FilmOwnership<S> {
  readonly chapter: number;
  readonly earned: boolean;
  /** Owned by the film: built for its handoff, disposed when the film ends. */
  previous: S | null;
  previousBuild: LifecycleBuild<S> | null;
  previousFailed: boolean;
}

export class VillageOwnership<S extends LifecycleScene> {
  screen: VillageScreen = 'hidden';
  /** The built map scene. Retained across hidden/overview/workshop/film; the film BORROWS it. */
  scene: S | null = null;
  /** Building the map scene of `build.chapter`. At most one build of any kind runs. */
  build: LifecycleBuild<S> | null = null;
  failedChapter: number | null = null;
  film: FilmOwnership<S> | null = null;

  constructor(private readonly startBuild: (chapter: number) => LifecycleBuild<S>, private readonly changed: () => void) {}

  showMap(chapter: number): void {
    this.endFilm(); this.screen = 'map'; this.ensure(chapter); this.scene?.activateProof();
  }
  leave(screen: 'overview' | 'workshop' | 'hidden'): void {
    this.endFilm(); this.screen = screen;
    this.build?.cancel(); this.build = null;
    this.scene?.suspendProof();
  }
  openFilm(chapter: number, earned: boolean): void {
    this.endFilm(); this.screen = 'film'; this.ensure(chapter);
    this.film = { chapter, earned, previous: null, previousBuild: null, previousFailed: false };
    this.scene?.activateProof(); this.pump();
  }
  /** Back, finish or any screen change: the film's owned previous work is released; the
   *  borrowed map scene stays with the map (its proof keeps the map's state). */
  endFilm(): void {
    const film = this.film; if (!film) return;
    this.film = null; film.previousBuild?.cancel(); film.previous?.dispose();
  }
  /** Both scenes the film renders, once built; null while either is missing. */
  filmScenes(): { readonly current: S; readonly previous: S | null } | null {
    const film = this.film;
    if (!film || this.scene?.chapter !== film.chapter) return null;
    if (film.chapter > 0 && !film.previous) return null;
    return { current: this.scene, previous: film.previous };
  }
  filmFailed(): boolean {
    const film = this.film;
    return !!film && (film.previousFailed || this.failedChapter === film.chapter);
  }
  dispose(): void {
    this.endFilm(); this.build?.cancel(); this.build = null; this.scene?.dispose(); this.scene = null; this.screen = 'hidden';
  }

  private ensure(chapter: number): void {
    if (this.scene && this.scene.chapter !== chapter) { this.scene.dispose(); this.scene = null; }
    if (this.build && this.build.chapter !== chapter) { this.build.cancel(); this.build = null; }
    if (this.failedChapter !== chapter) this.failedChapter = null;
    if (!this.scene && !this.build) {
      const build = this.startBuild(chapter); this.build = build;
      build.onSettled(() => this.settled(build));
    }
  }
  private settled(build: LifecycleBuild<S>): void {
    if (this.build === build) {
      this.build = null;
      if (build.state === 'done') {
        this.scene = build.take(); this.failedChapter = null;

      } else this.failedChapter = build.chapter;
    } else if (this.film?.previousBuild === build) {
      const film = this.film;
      film.previousBuild = null;
      if (build.state === 'done') { film.previous = build.take(); }
      else film.previousFailed = true;
    }
    this.pump(); this.changed();
    // The presentation callback installs visibility/home before eligibility can start work.
    if(this.screen==='map'||this.screen==='film'){this.scene?.activateProof();this.film?.previous?.activateProof();}
  }
  /** The film's previous scene builds only after the map scene: one build at a time. */
  private pump(): void {
    const film = this.film;
    if (!film || this.failedChapter === film.chapter || film.chapter === 0 || film.previous || film.previousBuild || film.previousFailed || this.build) return;
    const build = this.startBuild(film.chapter - 1); film.previousBuild = build;
    build.onSettled(() => this.settled(build));
  }
}

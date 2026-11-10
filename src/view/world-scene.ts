import{certifyRockerScene}from'./gravity-rocker-native';
import{bindNativeTerrain}from'./village-terrain';
import * as THREE from 'three';
import type { Stage } from '../engine/stage';
import type { MarbleEntity } from '../engine/marbles';
import type { ScreenPoint } from '../engine/contracts';
import type { WorldChapter } from '../world/progression';
import { villageScenePlan, type VillageScenePlan } from '../world/village-plans';
import { compileTerrain, terrainHeightAt } from '../world/village-terrain';
import { VILLAGE_RADIUS, type VillagePlan, type VillageCameraShot } from '../world/village-plan';
import { completedLevels } from '../progress';
import { earnedProjects } from '../world/workshop-projects';
import { findWorkshopPass, workshopSignPlacement } from '../world/workshop-building';
import { VillageMachine } from './village-machine';
import { VillageFilmCamera } from './village-film-camera';
import { WorldKitAssets } from './world-kit';
import { createVillageTerrain } from './village-terrain';
import { createProjectReward } from './project-rewards';
import { WorkshopBuilding } from './workshop-building';
import { bakeWorldGroup } from './world-bake';
import { browserScheduler, drain, type TaskScheduler } from './cooperative';
import { defaultStaticProofBackend, type StaticProofBackend, type StaticProofOwner } from './static-proof-owner';
import { assertStaticSupportCertificate } from './static-support-graph';

const MAX_YAW = Math.PI / 12;
/** Production defaults: the module worker and the browser scheduler. Tests inject both. */
export interface WorldSceneOptions {
  readonly motion?:'physical'|'cinematic'; readonly proof?: StaticProofBackend; readonly scheduler?: TaskScheduler; readonly sliceMs?: number }
const STAGED = Symbol('staged construction');

/** Each chapter owns its terrain, machine and dressing; only the renderer is shared. */
export class WorldScene {
  readonly scene: THREE.Scene;
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 220);
  private sceneMachine?: VillageMachine;
  private scenePlanned?: VillagePlan;
  /** Only built scenes leave SceneBuild; these throw if a half-built scene is ever reached. */
  get machine(): VillageMachine { if (!this.sceneMachine) throw new Error('Village scene is still being built'); return this.sceneMachine; }
  get plan(): VillagePlan { if (!this.scenePlanned) throw new Error('Village scene is still being built'); return this.scenePlanned; }
  private readonly scenePlan: VillageScenePlan;
  private readonly assets = new WorldKitAssets();
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  private readonly builds: THREE.Group[] = [];
  private readonly foundations: THREE.Group[] = [];
  private readonly badges: THREE.Vector3[] = [];
  private readonly anchors: THREE.Vector3[] = [];
  // Assigned once by complete(); never read before construction finishes.
  private filmCamera!: VillageFilmCamera;
  private workshopBuilding!: WorkshopBuilding;
  private workshopPass = 0;
  private staticProof: StaticProofOwner | undefined;
  private constructed = false;
  private filmStarted = false;
  private disposed = false;
  private detachedBaked: THREE.BufferGeometry | undefined;
  private detachedGround: THREE.BufferGeometry | undefined;
  private readonly installedProjects = new Set<string>();
  private marble: MarbleEntity | null = null;
  private growing: number | null = null;
  private growth = 1;
  private built: boolean[] = [];
  private angle = 0;
  private rockerFilmReady=true;
  private readonly hasAxle:boolean;
  get filmShots(): readonly VillageCameraShot[] { return this.filmCamera.shots; }
  get yaw(): number { return this.angle; }
  get constructionProgress(): number { return this.growth; }

  constructor(private readonly stage: Stage, readonly chapter: number, options: WorldSceneOptions = {}, mode?: typeof STAGED) {
    this.scenePlan = villageScenePlan(chapter);
    this.hasAxle=this.scenePlan.plan.stations.some(s=>s.mechanism.kind==='wheelbucket'&&s.mechanism.axleCarry);
    this.scene = stage.createScene('arcade');
    this.scene.background = new THREE.Color(0x172e3b);
    this.scene.traverse(object => { if (object instanceof THREE.Light) object.castShadow = false; });
    if (mode === STAGED) return;
    let complete = false;
    try { drain(this.complete(options)); complete = true; } finally { if (!complete) this.dispose(); }
  }
  /** SceneBuild's cooperative construction. A partial scene never escapes: cancel or failure disposes it. */
  static *construct(stage: Stage, chapter: number, options: WorldSceneOptions = {}): Generator<unknown, WorldScene, void> {
    const world = new WorldScene(stage, chapter, options, STAGED);
    let complete = false;
    try { yield* world.complete(options); complete = true; return world; } finally { if (!complete) world.dispose(); }
  }
  /** The former constructor body, unchanged in order: one bounded step per yield. */
  private *complete(options: WorldSceneOptions): Generator<unknown, void, void> {
    const chapter = this.chapter;
    const terrain = compileTerrain(this.scenePlan.terrain);
    yield 'terrain';
    const landscape = new THREE.Group(); landscape.name = `village-landscape-${chapter}`;
    const ground = createVillageTerrain(terrain, this.material); landscape.add(ground);
    this.detachedGround = ground.geometry;
    yield 'ground';
    for (const piece of this.scenePlan.scenery) {
      const model = this.model(piece.model);
      model.position.fromArray(piece.position); model.rotation.y = piece.yaw; model.scale.setScalar(piece.scale);
      landscape.add(model);
      yield 'scenery';
    }
    const workshop = this.scenePlan.workshop;
    const house = this.model('house-a'); house.position.fromArray(workshop.house.position);
    house.rotation.y = workshop.house.yaw; house.scale.setScalar(workshop.house.scale); landscape.add(house);
    this.workshopBuilding = new WorkshopBuilding(this.material, workshopSignPlacement(workshop));
    landscape.add(this.workshopBuilding.fixed);
    yield 'workshop';
    const bakedLand=bakeWorldGroup(landscape, this.material)!;this.detachedBaked=bakedLand?.geometry;bindNativeTerrain(ground.geometry,bakedLand);
    ground.geometry.dispose(); this.detachedGround = undefined;
    this.scene.add(landscape, this.workshopBuilding.sign);this.detachedBaked=undefined;
    yield 'land-merge';
    this.sceneMachine = new VillageMachine(this.scenePlan.plan, this.assets, this.material, (x, z) => terrainHeightAt(terrain, x, z), bakedLand,this.scenePlan.plan.staticSupports?this.scene:undefined,'staged',options.motion??'physical');
    yield 'route';
    yield* this.sceneMachine.construction();
    this.scenePlanned = this.machine.route.plan;
    this.scene.add(this.machine.root);
    yield 'scene-root';
    this.filmCamera = new VillageFilmCamera(this.machine, this.machine.route,this.machine.route.mode==='cinematic'?'cargo':'envelope');
    yield 'film-camera';
    const source = this.plan.stations.find(station => station.stop === workshop.connector.from);
    const destination = this.plan.stations.find(station => station.stop === workshop.connector.to);
    if (!source || !destination || !this.plan.connectors.some(link => link.from === source.stop && link.to === destination.stop)) {
      throw new Error('Workshop must name an authored village connector');
    }
    this.workshopPass = findWorkshopPass((seconds, point) => this.machine.sample(seconds, point), new THREE.Vector3(), {
      start: source.end, end: destination.start,
      house: { x: workshop.house.position[0], y: workshop.house.position[1], z: workshop.house.position[2] },
    });
    yield 'workshop-pass';
    for (let stop = 0; stop < 10; stop++) {
      const station = this.plan.stations.find(station => station.stop === stop)!;
      const anchor = new THREE.Vector3(...station.anchor);
      this.badges.push(new THREE.Vector3(...station.badge));
      this.anchors.push(anchor);
      // Compiler meshes are world-space. The inverse child leaves the rest pose
      // unchanged while construction rotates or translates around this station.
      const build = new THREE.Group(), local = new THREE.Group();
      build.position.copy(anchor); local.position.copy(anchor).negate();
      local.add(this.machine.groups[stop]!); build.add(local); this.machine.root.add(build); this.builds.push(build);
      const foundation = new THREE.Group(); foundation.name = `village-foundation-${stop}`;
      const mount = station.supports?.[0];
      const x = mount?.[0] ?? anchor.x, z = mount?.[2] ?? anchor.z;
      const height = terrainHeightAt(terrain, x, z);
      if (height === undefined) throw new Error('Village foundation needs an authored bank mount');
      const geometry = new THREE.BoxGeometry(1.7, 0.12, 1.5); geometry.deleteAttribute('uv');
      const color = new THREE.Color(0xb9b49a), colors = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let index = 0; index < colors.length; index += 3) color.toArray(colors, index);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      foundation.add(new THREE.Mesh(geometry, this.material)); foundation.position.set(x, height + 0.06, z);
      foundation.visible = false; this.foundations.push(foundation); this.scene.add(foundation);
    }
    yield 'foundations';
    if(this.machine.route.mode==='physical'&&this.scenePlan.plan.stations.some(s=>s.rollingDrive?.kind==='contact-gravity-rocker')){this.machine.apply(0);this.scene.updateMatrixWorld(true);try{certifyRockerScene(this.machine,bakedLand);this.rockerFilmReady=this.machine.route.motionStatus.state==='ready';}catch(error){this.dispose();throw error;}}
    yield 'rocker';
    this.installProjects(); this.setYaw(0);
    yield 'projects';
    if(this.machine.route.mode==='physical')this.staticProof = yield* this.machine.sealStaticProof(options.proof ?? defaultStaticProofBackend(), () => this.constructed && this.nativeAtRest(), options.scheduler ?? browserScheduler(), options.sliceMs);
    this.constructed = true;
  }

  private model(name: string): THREE.Group {
    if (!this.assets.modelNames.includes(name)) throw new Error(`Village model is missing: ${name}`);
    return this.assets.model(name, this.material);
  }
  private installProjects(): void {
    for (const project of earnedProjects(new Set(completedLevels()))) {
      if (project.chapter !== this.chapter || this.installedProjects.has(project.id)) continue;
      const slot = this.scenePlan.rewards.find(slot => slot.project === project.id);
      if (!slot) throw new Error(`Village reward slot is missing: ${project.id}`);
      const reward = createProjectReward(project.reward, this.assets, this.material);
      reward.name = `project-${project.id}`; reward.position.fromArray(slot.position); reward.rotation.y = slot.yaw;
      bakeWorldGroup(reward, this.material); this.scene.add(reward); this.installedProjects.add(project.id);
    }
  }
  setYaw(radians: number): void {
    this.angle = THREE.MathUtils.clamp(radians, -MAX_YAW, MAX_YAW);
    const target = this.filmCamera.restTarget, distance = this.filmCamera.restDistance;
    const horizontal = Math.cos(this.filmCamera.restElevation) * distance;
    this.camera.position.set(target.x + Math.sin(this.angle) * horizontal,
      target.y + Math.sin(this.filmCamera.restElevation) * distance, target.z + Math.cos(this.angle) * horizontal);
    this.camera.lookAt(target); this.camera.zoom = 1; this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }
  update(chapter: WorldChapter, animate: boolean): void {
    this.installProjects(); this.stopFilm(); this.machine.apply(0); this.workshopBuilding.reset(); this.setYaw(0);
    const next = chapter.stops.map(stop => stop.status === 'built');
    const growing = animate ? next.findIndex((built, index) => built && this.built[index] === false) : -1;
    this.growing = growing < 0 ? null : growing; this.growth = this.growing === null ? 1 : 0; this.built = next;
    this.builds.forEach((build, index) => {
      build.visible = next[index] === true; this.constructionPose(index, index === this.growing ? 0 : 1);
      this.foundations[index]!.visible = index < chapter.stops.length && !next[index];
    });
    this.staticProof?.checkpoint();
  }
  private constructionPose(stop: number, progress: number): void {
    const build = this.builds[stop]!, anchor = this.anchors[stop]!;
    const remaining = (1 - progress) ** 3;
    build.position.copy(anchor); build.rotation.set(0, 0, 0);
    switch (this.scenePlan.construction) {
      case 'rise': build.position.y -= remaining * 2; break;
      case 'drop': build.position.y += remaining * 3; break;
      case 'swing': build.rotation.z = -remaining * 0.35; break;
    }
  }
  resize(): void {
    const width = this.stage.canvas.clientWidth || window.innerWidth, height = this.stage.canvas.clientHeight || window.innerHeight;
    this.stage.renderer.setSize(width, height, false); this.camera.aspect = width / height;
    this.filmCamera.resize(this.camera.aspect); this.setYaw(this.angle);
  }
  private project(points: readonly THREE.Vector3[]): readonly ScreenPoint[] {
    const rect = this.stage.rect;
    return points.map(point => { const at = point.clone().project(this.camera);
      return { x: rect.left + (at.x + 1) * rect.width / 2, y: rect.top + (1 - at.y) * rect.height / 2 }; });
  }
  targets(): readonly ScreenPoint[] { return this.project(this.badges); }
  groundTargets(): readonly ScreenPoint[] { return this.project(this.anchors); }
  workshopTargets(): { badge: ScreenPoint; door: ScreenPoint } {
    const site = this.scenePlan.workshop;
    const [badge, door] = this.project([new THREE.Vector3(...site.badge), new THREE.Vector3(...site.door)]);
    return { badge: badge!, door: door! };
  }
  advance(seconds: number): boolean {
    if (this.growth >= 1 || this.growing === null) return false;
    this.growth = Math.min(1, this.growth + seconds / 0.65); this.constructionPose(this.growing, this.growth);
    if (this.growth >= 1) this.staticProof?.checkpoint();
    return true;
  }
  finishConstruction(): void {
    if (this.growing !== null) { this.constructionPose(this.growing, 1); this.growing = null; this.growth = 1; }
    this.staticProof?.checkpoint();
  }
  /** Native static frames are those recorded at sealing: no stop rising, none hidden. An
   *  incomplete village is never eligible; its proof simply does not start. */
  private nativeAtRest(): boolean { return !this.disposed && this.growth >= 1 && this.builds.every(build => build.visible); }
  /** The map or a film shows this scene. */
  activateProof(): void { this.staticProof?.activate(); }
  /** Gameplay, valley or Workshop: unfinished proof work stops; a certificate is kept. */
  suspendProof(): void { this.staticProof?.suspend(); }
  /** O(1): a film may only render this scene once its supports are confirmed. */
  filmReadiness(): 'ready' | 'pending' | 'failed' {
    if(this.machine.route.playback.state!=='ready'&&this.machine.route.mode==='cinematic')return 'failed';
    const status = this.staticProof?.status;
    if (!status || status.state === 'ready') return 'ready';
    return status.state === 'idle' || status.state === 'pending' ? 'pending' : 'failed';
  }
  /** Once per film start, atomically: the accepted certificate must still describe the live scene. */
  beginFilm(): void {
    const status = this.staticProof?.status; if (!status) return;
    if (status.state !== 'ready') throw new Error('Village supports are not confirmed');
    try { assertStaticSupportCertificate(status.certificate); this.filmStarted=true; } catch (error) { this.staticProof!.invalidate(String((error as Error).message)); throw error; }
  }
  /** The film's first framing without the marble or motion, shown while it waits. */
  filmPoster(cameraMotion = true): void {
    this.stopFilm(); this.machine.apply(0, !cameraMotion);
    this.workshopBuilding.apply(0, this.workshopPass, !cameraMotion);
    this.filmCamera.apply(this.camera, 0, cameraMotion); this.draw();
  }
  private requireFilmReady(): void {
    if (this.staticProof && this.staticProof.status.state !== 'ready') throw new Error('Village supports are not confirmed');
    if(this.staticProof&&!this.filmStarted)this.beginFilm();
  }
  film(seconds: number, cameraMotion = true): void {
    this.requireFilmReady();
    if(this.machine.route.mode==='physical'){if(!this.rockerFilmReady||this.hasAxle)this.machine.route.requirePhysical();}else if(this.machine.route.playback.state!=='ready')throw Error(this.machine.route.playback.reason);
    if(this.stage.canvas.dataset)this.stage.canvas.dataset.worldMotion=this.machine.route.mode;
    this.marble ??= this.stage.marbles.create('red', VILLAGE_RADIUS);
    const marble = this.marble.mesh; if (!marble.parent) this.scene.add(marble);
    this.machine.apply(seconds, !cameraMotion); this.machine.sample(seconds, marble.position);
    this.machine.marbleOrientation(seconds, marble.quaternion);
    this.workshopBuilding.apply(seconds, this.workshopPass, !cameraMotion);
    this.filmCamera.apply(this.camera, seconds, cameraMotion); this.draw();
  }
  handoff(seconds: number): void {
    this.requireFilmReady();
    this.marble ??= this.stage.marbles.create('red', VILLAGE_RADIUS);
    const marble = this.marble.mesh; if (!marble.parent) this.scene.add(marble);
    this.machine.handoff(seconds, marble.position);
    if(this.machine.route.mode==='cinematic')this.machine.marbleOrientation(Math.max(0,Math.min(2.5,seconds)),marble.quaternion);
    else marble.rotation.z = -THREE.MathUtils.smoothstep(seconds, 0, 2.5) * 7 / VILLAGE_RADIUS;
    this.workshopBuilding.reset(); this.setYaw(0); this.draw();
  }
  draw(): void { this.stage.draw(this.scene, this.camera); }
  stopFilm(): void { this.filmStarted=false;if (this.marble) this.stage.marbles.release(this.marble); this.marble = null; }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.constructed=false;this.stopFilm(); this.workshopBuilding?.dispose(); this.sceneMachine?.dispose(); this.detachedGround?.dispose();this.detachedBaked?.dispose();
    this.stage.disposeScene(this.scene); this.assets.dispose(); this.material.dispose();
  }
}

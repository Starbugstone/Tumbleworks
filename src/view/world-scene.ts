import{certifyRockerScene}from'./gravity-rocker-native';
import{bindNativeTerrain}from'./village-terrain';
import { buildTimber } from './harbour-craft';
import * as THREE from 'three';
import { HarbourLaunch } from './harbour-life';
import type { Stage } from '../engine/stage';
import { boxCorners } from '../engine/framing';
import type { MarbleEntity } from '../engine/marbles';
import type { ScreenPoint } from '../engine/contracts';
import type { WorldChapter } from '../world/progression';
import { villageScenePlan, type VillageScenePlan } from '../world/village-plans';
import { compileTerrain, terrainHeightAt, type VillageTerrain } from '../world/village-terrain';
import { VILLAGE_RADIUS, type VillagePlan, type VillageCameraShot } from '../world/village-plan';
import { completedLevels } from '../progress';
import { earnedProjects } from '../world/workshop-projects';
import { findWorkshopPass, workshopSignPlacement } from '../world/workshop-building';
import { VillageMachine } from './village-machine';
import { VillageFilmCamera } from './village-film-camera';
import { WorldKitAssets } from './world-kit';
import { createVillageTerrain, rockContour, sunny } from './village-terrain';
import { VillageOrbit } from './village-orbit';
import { separateMapPins } from './map-pins';
import { tropicalCoast, islandPalms, riverBanks, triangleBounds } from './tropical-island';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { villageSea, advanceVillageSea } from './village-sea';
import { createProjectReward } from './project-rewards';
import { WorkshopBuilding } from './workshop-building';
import { bakeWorldGroup, appendWorldGeometry } from './world-bake';
import { browserScheduler, drain, type TaskScheduler } from './cooperative';
import { defaultStaticProofBackend, type StaticProofBackend, type StaticProofOwner } from './static-proof-owner';
import { assertStaticSupportCertificate } from './static-support-graph';

const MAX_YAW = Math.PI / 12;
/** Production defaults: the module worker and the browser scheduler. Tests inject both. */
export interface WorldSceneOptions {
  readonly motion?:'physical'|'cinematic'; readonly proof?: StaticProofBackend; readonly scheduler?: TaskScheduler; readonly sliceMs?: number }
const STAGED = Symbol('staged construction');

/**
 * Shore clearance around each triangle of a house or scenery piece. Hardly any below: the shore never rises
 * above the bank a piece stands on, so padding below its base just sank the shore and bared the stepped cliff.
 */
const SCENERY_CLEARANCE = new THREE.Vector3(.3, .05, .3);
/** Moments along the film at which each moving part's sweep is sampled for shore clearance. */
const MOTION_SAMPLES = 24;
/** Shore clearance around every machine triangle at rest, and around each moving part as it sweeps. */
const MACHINE_CLEARANCE = new THREE.Vector3(.15, .02, .15);
/** The slab construction lays under a station: width, thickness, depth. */
const FOUNDATION = [1.7, 0.12, 1.5] as const;
function foundationSite(station: { readonly anchor: readonly number[]; readonly supports?: readonly (readonly number[])[] }, terrain: VillageTerrain): { x: number; z: number; height: number } {
  const mount = station.supports?.[0];
  const x = mount?.[0] ?? station.anchor[0]!, z = mount?.[2] ?? station.anchor[2]!;
  const height = terrainHeightAt(terrain, x, z);
  if (height === undefined) throw new Error('Village foundation needs an authored bank mount');
  return { x, z, height };
}
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
  private readonly assets: WorldKitAssets;
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
  cameraMode: 'map' | 'film' = 'film';
  private mapOrbit?: VillageOrbit;
  private sea?: THREE.Mesh;
  private launch?: HarbourLaunch;
  private harbourSeconds = 0;
  get hasVillageLife(): boolean { return this.launch !== undefined; }
  readonly coastalDressing={beachCount:0,palmCount:0};
  get orbit(): VillageOrbit { if (!this.mapOrbit) throw new Error('Village is still building'); return this.mapOrbit; }
  private rockerFilmReady=true;
  private readonly hasAxle:boolean;
  get filmShots(): readonly VillageCameraShot[] { return this.filmCamera.shots; }
  get yaw(): number { return this.angle; }
  get constructionProgress(): number { return this.growth; }

  constructor(private readonly stage: Stage, readonly chapter: number, options: WorldSceneOptions = {}, mode?: typeof STAGED) {
    this.assets = new WorldKitAssets(true, chapter === 0, chapter === 0 && options.motion === 'cinematic');
    this.scenePlan = villageScenePlan(chapter);
    this.hasAxle=this.scenePlan.plan.stations.some(s=>s.mechanism.kind==='wheelbucket'&&s.mechanism.axleCarry);
    this.scene = stage.createScene('village');
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
    const chapter = this.chapter, coastalProtected: THREE.Box3[] = [];
    if (chapter === 0 && options.motion === 'cinematic') this.scene.background = new THREE.Color(0x8ab3c5);
    const terrain = compileTerrain((options.motion === 'cinematic' && this.scenePlan.cinematicTerrain) || this.scenePlan.terrain);
    yield 'terrain';
    const landscape = new THREE.Group(); landscape.name = `village-landscape-${chapter}`;
    // The land as drawn: dressing beside it (river banks) continues these colours.
    const drawn = { ...terrain, spec: { ...terrain.spec, mergeFlatLand:true, rockContour:true, palette: chapter === 0 ? { ...terrain.spec.palette, grass: 0x82a397, grassAlt: 0x82a397, cliff: 0x626f74, rock: 0x869492, shore: 0xe4c899 } : { ...terrain.spec.palette, grass: 0x7b917c, grassAlt: 0x7b917c, cliff: 0xa1a38a, rock: 0xb0ac91, shore: 0xecd5a3 } } };
    rockContour(this.material, sunny(drawn.spec.palette.rock, new THREE.Color()), chapter === 0 ? sunny(drawn.spec.palette.grass, new THREE.Color()) : undefined);
    const ground = createVillageTerrain(drawn, this.material, 'full', true); landscape.add(ground);
    this.detachedGround = ground.geometry;
    yield 'ground';
    const scenery = options.motion === 'cinematic' ? this.scenePlan.cinematicScenery ?? this.scenePlan.scenery : this.scenePlan.scenery;
    for (const piece of scenery) {
      const model = this.model(piece.model);
      model.position.fromArray(piece.position); model.rotation.y = piece.yaw; model.scale.setScalar(piece.scale);
      if (terrain.spec.beachWidth && piece.model === 'boat' && piece.position[0] < 1) {
        bakeWorldGroup(model, this.material);
        model.traverse(part => { part.castShadow = false; });
        this.launch = new HarbourLaunch(model);
        this.scene.add(model);
        continue;
      }
      triangleBounds(model,SCENERY_CLEARANCE,coastalProtected);
      landscape.add(model);
      yield 'scenery';
    }
    const workshop = this.scenePlan.workshop;
    const house = this.model('house-a'); house.position.fromArray(workshop.house.position);
    house.rotation.y = workshop.house.yaw; house.scale.setScalar(workshop.house.scale); landscape.add(house); triangleBounds(house,SCENERY_CLEARANCE,coastalProtected);
    this.workshopBuilding = new WorkshopBuilding(this.material, workshopSignPlacement(workshop));
    landscape.add(this.workshopBuilding.fixed);
    yield 'workshop';
    const bakedLand=bakeWorldGroup(landscape, this.material)!;this.detachedBaked=bakedLand?.geometry;bindNativeTerrain(ground.geometry,bakedLand);
    ground.geometry.dispose(); this.detachedGround = undefined;
    this.scene.add(landscape, this.workshopBuilding.sign);this.detachedBaked=undefined;
    // One water surface continues through every inlet; the terrain omits its old water sheets.
    this.sea = villageSea(terrain.spec.water, terrain.spec.palette.water, terrain, this.launch?.wake); this.scene.add(this.sea);
    bakedLand.geometry.computeBoundingBox();
    this.stage.fitShadows?.(this.scene, boxCorners(bakedLand.geometry.boundingBox!.clone().applyMatrix4(bakedLand.matrixWorld)), 1);
    yield 'land-merge';
    this.sceneMachine = new VillageMachine(this.scenePlan.plan, this.assets, this.material, (x, z) => terrainHeightAt(terrain, x, z), bakedLand,this.scenePlan.plan.staticSupports?this.scene:undefined,'staged',options.motion??'physical');
    yield 'route';
    yield* this.sceneMachine.construction();
    this.scenePlanned = this.machine.route.plan;
    this.scene.add(this.machine.root);
    yield 'scene-root';
    this.machine.root.updateWorldMatrix(true,true);
    triangleBounds(this.machine.root,MACHINE_CLEARANCE,coastalProtected);
    // A moving part sweeps through more than its rest pose: keep the shore clear of each one along the film.
    const rest=new Map<THREE.Mesh,THREE.Matrix4>();this.machine.root.traverse(object=>{if(object instanceof THREE.Mesh)rest.set(object,object.matrixWorld.clone());});
    for(let step=1;step<=MOTION_SAMPLES;step++){
      this.machine.apply(this.machine.route.duration*step/MOTION_SAMPLES);this.machine.root.updateMatrixWorld(true);
      for(const [mesh,matrix] of rest)if(!mesh.matrixWorld.equals(matrix))coastalProtected.push(new THREE.Box3().setFromObject(mesh).expandByVector(MACHINE_CLEARANCE));
    }
    this.machine.apply(0);this.machine.root.updateMatrixWorld(true);
    for (const slot of this.scenePlan.rewards) coastalProtected.push(new THREE.Box3(new THREE.Vector3(...slot.position).addScalar(-3),new THREE.Vector3(...slot.position).addScalar(3)));
    // Construction lays a slab under each station; the shore keeps clear of it too.
    for (const station of this.plan.stations) { const { x, z, height } = foundationSite(station, terrain); coastalProtected.push(new THREE.Box3(new THREE.Vector3(x - FOUNDATION[0] / 2, height, z - FOUNDATION[2] / 2), new THREE.Vector3(x + FOUNDATION[0] / 2, height + FOUNDATION[1], z + FOUNDATION[2] / 2)).expandByVector(SCENERY_CLEARANCE)); }
    for(let seconds=0;seconds<=this.machine.route.duration;seconds+=.15){const p=new THREE.Vector3();this.machine.sample(seconds,p);coastalProtected.push(new THREE.Box3(p.clone().addScalar(-.8),p.clone().addScalar(.8)));}
    const coast=tropicalCoast(terrain,coastalProtected),banks=terrain.spec.beachWidth ? null : riverBanks(drawn,coastalProtected);
    const shore=banks?mergeGeometries([coast,banks]):coast;if(banks){coast.dispose();banks.dispose();}
    if(!shore)throw new Error('Shore dressing could not be merged');
    const beach = new THREE.Mesh(shore,this.material); beach.name='village-beach'; beach.receiveShadow=true;
    const palms=islandPalms(terrain,beach,coastalProtected,this.material);
    const beachCount=(beach.geometry.index?.count??beach.geometry.getAttribute('position').count);
    const palmCount=palms?.geometry.getAttribute('position').count??0;
    const dressingStart=bakedLand.geometry.getAttribute('position').count;
    appendWorldGeometry(bakedLand,[beach.geometry,...(palms?[palms.geometry]:[])]);
    bakedLand.geometry.userData['coastalDressing']={first:dressingStart,beachCount,palmCount};Object.assign(this.coastalDressing,{beachCount,palmCount});
    const mapBounds=bakedLand.geometry.boundingBox!.clone();
    if(beach.geometry.getAttribute('position').count)mapBounds.union(new THREE.Box3().setFromObject(beach));
    // appendWorldGeometry has already included every beach and palm vertex.
    this.mapOrbit=new VillageOrbit(mapBounds,bakedLand.geometry.getAttribute('position'));
    beach.geometry.dispose();palms?.geometry.dispose();
    yield 'coast';
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
      const { x, z, height } = foundationSite(station, terrain);
      if (chapter === 0 && options.motion === 'cinematic') {
        foundation.add(new THREE.Mesh(buildTimber(), this.material));
        foundation.position.set(x,height,z);
        foundation.rotation.y = (stop % 3 - 1) * .18;
      } else {
        const geometry = new THREE.BoxGeometry(FOUNDATION[0], FOUNDATION[1], FOUNDATION[2]); geometry.deleteAttribute('uv');
        const color = new THREE.Color(0xb9b49a), colors = new Float32Array(geometry.getAttribute('position').count * 3);
        for (let index = 0; index < colors.length; index += 3) color.toArray(colors, index);
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        foundation.add(new THREE.Mesh(geometry, this.material)); foundation.position.set(x, height + 0.06, z);
      }
      foundation.visible = false; this.foundations.push(foundation); this.scene.add(foundation);
    }
    yield 'foundations';
    if(this.machine.route.mode==='physical'&&this.scenePlan.plan.stations.some(s=>s.rollingDrive?.kind==='contact-gravity-rocker')){this.machine.apply(0);this.scene.updateMatrixWorld(true);try{certifyRockerScene(this.machine,bakedLand);this.rockerFilmReady=this.machine.route.motionStatus.state==='ready';}catch(error){this.dispose();throw error;}}
    yield 'rocker';
    this.installProjects(); this.setYaw(0); this.shade();
    yield 'projects';
    if(this.machine.route.mode==='physical')this.staticProof = yield* this.machine.sealStaticProof(options.proof ?? defaultStaticProofBackend(), () => this.constructed && this.nativeAtRest(), options.scheduler ?? browserScheduler(), options.sliceMs);
    this.constructed = true;
  }

  /**
   * Everything drawn with the village material takes shadows, so that material keeps one shader. Only what
   * never moves casts them, because the shadow map is drawn once: land, houses, fixed track and its supports.
   */
  private shade(): void {
    const fixed = (object: THREE.Object3D): boolean => /^village-landscape-|-static$|^project-|^village-foundation-/.test(object.name)
      || (object.parent !== null && fixed(object.parent));
    this.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object.material !== this.material) return;
      object.receiveShadow = true; object.castShadow = fixed(object);
    });
    this.stage.refreshShadows?.(this.scene);
  }
  private model(name: string): THREE.Group {
    const model = this.assets.model(name, this.material);
    if (!model.children.length) throw new Error(`Village model is missing: ${name}`);
    return model;
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
  inspect(): void {
    this.cameraMode='map';const width=this.stage.canvas.clientWidth||375,height=this.stage.canvas.clientHeight||690;this.camera.setViewOffset(width,height,0,height*.065,width,height);this.orbit.apply(this.camera);
    this.scene.userData['focus']={near:0,far:160,falloff:30};
  }
  resetView(): void { this.orbit.reset();this.inspect(); }
  stepSea(seconds: number, reduced: boolean): void {
    if (!this.sea || reduced) return;
    advanceVillageSea(this.sea, seconds);
    this.harbourSeconds += seconds;
    this.launch?.pose(this.harbourSeconds);
  }
  setYaw(radians: number): void {
    this.camera.clearViewOffset();this.cameraMode='film';
    this.angle = THREE.MathUtils.clamp(radians, -MAX_YAW, MAX_YAW);
    const target = this.filmCamera.restTarget, distance = this.filmCamera.restDistance;
    const horizontal = Math.cos(this.filmCamera.restElevation) * distance;
    this.camera.position.set(target.x + Math.sin(this.angle) * horizontal,
      target.y + Math.sin(this.filmCamera.restElevation) * distance, target.z + Math.cos(this.angle) * horizontal);
    this.camera.lookAt(target); this.camera.zoom = 1; this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
    // On the map the whole village is sharp and only the open sea softens.
    this.scene.userData['focus'] = { near: 0, far: distance + 22, falloff: 30 };
  }
  update(chapter: WorldChapter, animate: boolean): void {
    this.installProjects(); this.shade(); this.stopFilm(); this.machine.apply(0); this.workshopBuilding.reset(); this.setYaw(0);
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
    this.filmCamera.resize(this.camera.aspect); this.mapOrbit?.fit(this.camera.aspect,height); if(this.cameraMode==='map')this.inspect();else this.setYaw(this.angle);
  }
  private project(points: readonly THREE.Vector3[]): readonly ScreenPoint[] {
    const rect = this.stage.rect;
    return points.map(point => { const at = point.clone().project(this.camera);
      return { x: rect.left + (at.x + 1) * rect.width / 2, y: rect.top + (1 - at.y) * rect.height / 2 }; });
  }
  targets(): readonly ScreenPoint[] {
    const { width, height } = this.stage.rect;
    return separateMapPins(this.project(this.badges), width, height);
  }
  groundTargets(): readonly ScreenPoint[] { return this.project(this.anchors); }
  workshopTargets(): { badge: ScreenPoint; door: ScreenPoint } {
    const site = this.scenePlan.workshop;
    const [badge, door] = this.project([new THREE.Vector3(...site.badge), new THREE.Vector3(...site.door)]);
    return { badge: badge!, door: door! };
  }
  advance(seconds: number): boolean {
    if (this.growth >= 1 || this.growing === null) return false;
    this.growth = Math.min(1, this.growth + seconds / 0.65); this.constructionPose(this.growing, this.growth);
    this.stage.refreshShadows?.(this.scene);
    if (this.growth >= 1) this.staticProof?.checkpoint();
    return true;
  }
  finishConstruction(): void {
    if (this.growing !== null) { this.constructionPose(this.growing, 1); this.growing = null; this.growth = 1; this.stage.refreshShadows?.(this.scene); }
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
    this.camera.clearViewOffset();this.cameraMode='film'; this.stopFilm(); this.machine.apply(0, !cameraMotion);
    this.workshopBuilding.apply(0, this.workshopPass, !cameraMotion);
    this.filmCamera.apply(this.camera, 0, cameraMotion); this.draw();
  }
  private requireFilmReady(): void {
    if (this.staticProof && this.staticProof.status.state !== 'ready') throw new Error('Village supports are not confirmed');
    if(this.staticProof&&!this.filmStarted)this.beginFilm();
  }
  film(seconds: number, cameraMotion = true): void {
    this.camera.clearViewOffset();this.cameraMode='film'; this.requireFilmReady();
    if(this.machine.route.mode==='physical'){if(!this.rockerFilmReady||this.hasAxle)this.machine.route.requirePhysical();}else if(this.machine.route.playback.state!=='ready')throw Error(this.machine.route.playback.reason);
    if(this.stage.canvas.dataset)this.stage.canvas.dataset.worldMotion=this.machine.route.mode;
    if (!this.marble) { this.marble = this.stage.marbles.create('red', VILLAGE_RADIUS); this.marble.mesh.castShadow = false; }
    const marble = this.marble.mesh; if (!marble.parent) this.scene.add(marble);
    this.machine.apply(seconds, !cameraMotion); this.machine.sample(seconds, marble.position);
    this.material.userData.filmCargo?.copy(marble.position);
    this.machine.marbleOrientation(seconds, marble.quaternion);
    this.workshopBuilding.apply(seconds, this.workshopPass, !cameraMotion);
    this.filmCamera.apply(this.camera, seconds, cameraMotion);
    // Keep the working harbour and the action in the same sharp plane.
    const reach = this.camera.position.distanceTo(marble.position);
    this.scene.userData['focus'] = { near: 0, far: reach + 22, falloff: 35 };
    this.draw();
  }
  draw(): void { this.stage.draw(this.scene, this.camera); }
  stopFilm(): void { this.material.userData.filmCargo?.set(0,-100,0); this.filmStarted=false;if (this.marble) this.stage.marbles.release(this.marble); this.marble = null; }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.constructed=false;this.stopFilm(); this.workshopBuilding?.dispose(); this.sceneMachine?.dispose(); this.detachedGround?.dispose();this.detachedBaked?.dispose();
    this.stage.disposeScene(this.scene); this.assets.dispose(); this.material.dispose();
  }
}

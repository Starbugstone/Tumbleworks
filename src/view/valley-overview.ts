import * as THREE from 'three';
import { DEEP_SEA } from '../engine/stage';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Stage } from '../engine/stage';
import type { ScreenPoint } from '../engine/contracts';
import type { WorldProgress } from '../world/progression';
import { worldLayout, type ValleyLayout } from '../world/overview-layout';
import { villageScenePlan } from '../world/village-plans';
import { createVillageTerrain } from './village-terrain';
import { bakeWorldGroup } from './world-bake';
import { completedLevels } from '../progress';
import { earnedProjects } from '../world/workshop-projects';
import { createProjectReward } from './project-rewards';

export interface ValleyOverviewAssets {
  model(name: string, material: THREE.Material): THREE.Group;
  dispose(): void;
}

type OverviewStage = Pick<Stage, 'createScene' | 'draw' | 'disposeScene'> & {
  readonly canvas: Pick<HTMLCanvasElement, 'clientWidth' | 'clientHeight'>;
  readonly rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
  readonly renderer: Pick<THREE.WebGLRenderer, 'setSize'>;
};

export interface ValleyTarget extends ScreenPoint {
  readonly chapter: number;
  readonly width: number;
}

interface Village {
  readonly chapter: number;
  readonly anchor: THREE.Vector3;
  readonly label: THREE.Vector3;
  readonly group: THREE.Group;
  readonly hitbox: THREE.Box3;
  readonly material: THREE.MeshStandardMaterial;
}

/** The whole valley uses the existing renderer and has no clock, animation or automatic draws. */
export class ValleyOverview {
  readonly scene: THREE.Scene;
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 180);
  private readonly villages: Village[] = [];
  private readonly routeMaterial = new THREE.MeshStandardMaterial({ color: 0xd5bd8d, roughness: 0.95 });
  private readonly raycaster = new THREE.Raycaster();
  private readonly pickPoint = new THREE.Vector3();
  private layout: ValleyLayout;
  private route: THREE.Mesh | null = null;

  constructor(private readonly stage: OverviewStage, progress: WorldProgress, private readonly assets: ValleyOverviewAssets) {
    this.scene = stage.createScene('arcade');
    this.scene.background = new THREE.Color(DEEP_SEA);
    this.scene.environmentIntensity = 0.55;
    this.layout = worldLayout(progress.chapters.length, stage.rect);
    const rewards = earnedProjects(new Set(completedLevels()));
    for (const chapter of progress.chapters) {
      const source = villageScenePlan(chapter.index);
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
      const village = new THREE.Group(), group = new THREE.Group();
      group.name = `valley-village-${chapter.index}`;
      const ground = createVillageTerrain(source.terrain, material, 'overview'); village.add(ground);
      for (const piece of source.overview) {
        const model = this.assets.model(piece.model, material);
        model.position.fromArray(piece.position); model.rotation.y = piece.yaw; model.scale.setScalar(piece.scale);
        village.add(model);
      }
      // The Mill's driven wheel is procedural in the full scene, so its silhouette
      // needs the same disc in the miniature rather than an unrelated landmark.
      const wheel = source.plan.stations.find(station => station.mechanism.kind === 'wheelbucket');
      let signature: THREE.BufferGeometry | undefined;
      if (wheel?.mechanism.kind === 'wheelbucket') {
        signature = new THREE.TorusGeometry(wheel.mechanism.radius, 0.14, 4, 20);
        signature.deleteAttribute('uv');
        const color = new THREE.Color(0x82694c), colors = new Float32Array(signature.getAttribute('position').count * 3);
        for (let index = 0; index < colors.length; index += 3) color.toArray(colors, index);
        signature.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const disc = new THREE.Mesh(signature, material);
        disc.position.set(wheel.anchor[0], wheel.anchor[1] + wheel.mechanism.radius - 0.4, wheel.anchor[2] - 0.65);
        village.add(disc);
      }
      for (const project of rewards.filter(project => project.chapter === chapter.index)) {
        const slot = source.rewards.find(slot => slot.project === project.id);
        if (!slot) throw new Error(`Village miniature reward slot is missing: ${project.id}`);
        const reward = createProjectReward(project.reward, this.assets, material);
        reward.name = `project-${project.id}`; reward.position.fromArray(slot.position); reward.rotation.y = slot.yaw; village.add(reward);
      }
      const bounds = new THREE.Box3().setFromObject(village), center = bounds.getCenter(new THREE.Vector3());
      const scale = 6.4 / Math.max(source.terrain.size[0], source.terrain.size[1]);
      village.scale.setScalar(scale); village.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      group.add(village); bakeWorldGroup(group, material);
      ground.geometry.dispose(); signature?.dispose();
      this.scene.add(group);
      this.villages.push({ chapter: chapter.index, anchor: new THREE.Vector3(), label: new THREE.Vector3(),
        group, hitbox: new THREE.Box3(), material });
    }
    this.update(progress);
    this.resize();
  }

  private routes(): void {
    if (this.route) { this.route.geometry.dispose(); this.route.removeFromParent(); this.route = null; }
    const visible = this.villages.filter(village => village.group.visible);
    const pieces: THREE.BufferGeometry[] = [];
    for (let index = 1; index < visible.length; index++) {
      const from = visible[index - 1]!.anchor.clone();
      const to = visible[index]!.anchor.clone();
      from.y += 0.035; to.y += 0.035;
      from.z += 1.1; to.z += 1.1;
      const middle = from.clone().lerp(to, 0.5);
      middle.z += index % 2 === 0 ? -0.4 : 0.5;
      const path = new THREE.CatmullRomCurve3([from, middle, to]);
      pieces.push(new THREE.TubeGeometry(path, 18, 0.095, 4, false));
    }
    if (!pieces.length) return;
    const geometry = mergeGeometries(pieces);
    pieces.forEach(piece => piece.dispose());
    if (!geometry) throw new Error('Valley routes could not be merged');
    this.route = new THREE.Mesh(geometry, this.routeMaterial);
    this.route.name = 'valley-routes';
    this.scene.add(this.route);
  }

  update(progress: WorldProgress, selectedChapter = -1): void {
    for (const village of this.villages) {
      const chapter = progress.chapters.find(chapter => chapter.index === village.chapter);
      village.material.color.setHex(chapter?.available ? 0xffffff : 0x7a9192);
      village.material.emissive.setHex(chapter?.complete ? 0x102018 : selectedChapter === village.chapter ? 0x171508 : 0x000000);
    }
    if (selectedChapter >= 0) {
      const row = Math.floor(selectedChapter / 2);
      const first = row < this.layout.firstRow ? row : row >= this.layout.firstRow + 3 ? row - 2 : this.layout.firstRow;
      this.applyLayout(first);
    }
  }

  get firstRow(): number { return this.layout.firstRow; }
  get maxFirstRow(): number { return this.layout.maxFirstRow; }

  panRows(delta: number): boolean {
    if (!Number.isFinite(delta)) return false;
    const first = Math.max(0, Math.min(this.layout.maxFirstRow, this.layout.firstRow + Math.trunc(delta)));
    if (first === this.layout.firstRow) return false;
    this.applyLayout(first);
    return true;
  }

  private applyLayout(firstRow: number): void {
    this.layout = worldLayout(this.villages.length, this.stage.rect, firstRow);
    for (const village of this.villages) {
      const place = this.layout.villages.find(place => place.chapter === village.chapter);
      village.group.visible = place !== undefined;
      if (!place) continue;
      village.anchor.fromArray(place.position); village.label.fromArray(place.label);
      village.group.position.copy(village.anchor);
      village.group.updateWorldMatrix(true, true);
      village.hitbox.setFromObject(village.group).expandByVector(new THREE.Vector3(0.25, 0.25, 0.25));
    }
    this.routes();
  }

  resize(): void {
    const width = this.stage.canvas.clientWidth || this.stage.rect.width;
    const height = this.stage.canvas.clientHeight || this.stage.rect.height;
    this.stage.renderer.setSize(width, height, false);
    this.applyLayout(this.layout.firstRow);
    this.camera.aspect = width / height;
    const elevation = 50 * Math.PI / 180;
    this.camera.position.set(0, 2.6 + this.layout.cameraDistance * Math.sin(elevation), -0.8 + this.layout.cameraDistance * Math.cos(elevation));
    this.camera.lookAt(0, 2.6, -0.8);
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }

  targets(): readonly ValleyTarget[] {
    const rect = this.stage.rect;
    return this.villages.filter(village => village.group.visible).map(village => {
      const at = village.label.clone().project(this.camera);
      return { chapter: village.chapter, width: this.layout.labelWidth,
        x: rect.left + (at.x + 1) / 2 * rect.width,
        y: rect.top + (1 - at.y) / 2 * rect.height };
    });
  }

  /** Ray/box intersections do not add an object or a draw call to the scene. Locked villages still report a hit. */
  pick(x: number, y: number): number | null {
    const rect = this.stage.rect;
    this.raycaster.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), this.camera);
    let selected: number | null = null, distance = Infinity;
    for (const village of this.villages) {
      if (!village.group.visible || village.hitbox.isEmpty() || !this.raycaster.ray.intersectBox(village.hitbox, this.pickPoint)) continue;
      const hit = this.raycaster.ray.origin.distanceToSquared(this.pickPoint);
      if (hit < distance) { selected = village.chapter; distance = hit; }
    }
    return selected;
  }

  draw(): void { this.stage.draw(this.scene, this.camera); }

  dispose(): void {
    const attached = new Set<THREE.Material>();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) attached.add(material);
    });
    this.stage.disposeScene(this.scene);
    // Empty or not-yet-loaded model groups have no mesh through which Stage could release their material.
    for (const material of [this.routeMaterial, ...this.villages.map(village => village.material)]) if (!attached.has(material)) material.dispose();
    this.assets.dispose();
  }
}

import * as THREE from 'three';
import { DEEP_SEA } from '../engine/stage';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Stage } from '../engine/stage';
import type { ScreenPoint } from '../engine/contracts';
import type { WorldProgress } from '../world/progression';
import { worldLayout, type ValleyLayout } from '../world/overview-layout';
import { villageScenePlan } from '../world/village-plans';
import { miniatureLand, paintIslandChart } from './island-miniature';
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
  readonly coast: THREE.Vector3[];
  readonly hitbox: THREE.Box3;
  readonly material: THREE.MeshStandardMaterial;
}

/** Seat the building against the miniature's coarse mesh, including its downhill corners. */
function seatMiniature(model: THREE.Group, ground: THREE.Mesh, material: THREE.Material): THREE.BufferGeometry | undefined {
  model.updateMatrixWorld();
  const toLocal = model.matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  const bounds = new THREE.Box3().makeEmpty();
  const bottom = new THREE.Box3().setFromObject(model).min.y;
  model.traverse(part => {
    if (!(part instanceof THREE.Mesh)) return;
    const positions = part.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld);
      if (point.y <= bottom + .18) bounds.expandByPoint(point.applyMatrix4(toLocal));
    }
  });
  if (bounds.isEmpty()) return;

  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const middle = bounds.getCenter(new THREE.Vector3());
  let high = -Infinity, low = Infinity;
  for (const x of [bounds.min.x, middle.x, bounds.max.x]) {
    for (const z of [bounds.min.z, middle.z, bounds.max.z]) {
      point.set(x, 0, z).applyMatrix4(model.matrixWorld);
      point.y = 64;
      ray.set(point, down);
      const y = ray.intersectObject(ground)[0]?.point.y;
      if (y !== undefined) {
        high = Math.max(high, y);
        low = Math.min(low, y);
      }
    }
  }
  if (!Number.isFinite(low)) return;
  model.position.y += high - bottom - .025;
  model.updateMatrixWorld();

  const relief = high - low;
  if (relief < .045) return;
  const top = bounds.min.y, foot = top - (relief + .08) / model.scale.y;
  const ring = [
    [bounds.min.x, bounds.min.z], [bounds.max.x, bounds.min.z],
    [bounds.max.x, bounds.max.z], [bounds.min.x, bounds.max.z],
  ] as const;
  const vertices: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i]!, [u, v] = ring[(i + 1) % ring.length]!;
    vertices.push(x, top, z, u, top, v, u, foot, v, x, top, z, u, foot, v, x, foot, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const tint = new THREE.Color(0x988d78), colours: number[] = [];
  for (let i = 0; i < vertices.length; i += 3) colours.push(tint.r, tint.g, tint.b);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  model.add(new THREE.Mesh(geometry, material));
  return geometry;
}

/** The whole valley uses the existing renderer and has no clock, animation or automatic draws. */
export class ValleyOverview {
  readonly scene: THREE.Scene;
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 180);
  private readonly villages: Village[] = [];
  private readonly routeMaterial = new THREE.MeshStandardMaterial({ color: 0xb0bbb0, roughness: 0.95 });
  private readonly raycaster = new THREE.Raycaster();
  private readonly pickPoint = new THREE.Vector3();
  private layout: ValleyLayout;
  private route: THREE.Mesh | null = null;
  private chart?: THREE.CanvasTexture;

  constructor(private readonly stage: OverviewStage, progress: WorldProgress, private readonly assets: ValleyOverviewAssets) {
    this.scene = stage.createScene('arcade');
    this.scene.background = new THREE.Color(DEEP_SEA);
    this.scene.environmentIntensity = 0.25;
    this.layout = worldLayout(progress.chapters.length, stage.rect);
    const rewards = earnedProjects(new Set(completedLevels()));
    for (const chapter of progress.chapters) {
      const source = villageScenePlan(chapter.index);
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
      const village = new THREE.Group(), group = new THREE.Group();
      group.name = `valley-village-${chapter.index}`;
      const feet:THREE.BufferGeometry[]=[];
      const ground = new THREE.Mesh(miniatureLand(source.cinematicTerrain ?? source.terrain),material);
      ground.name = 'village-terrain-overview';
      village.add(ground);
      for (const piece of source.overview) {
        const model = this.assets.model(piece.model, material);
        model.position.fromArray(piece.position); model.rotation.y = piece.yaw; const landmark = ['harbour-beacon','mill','greenhouse','clock','bridge','glassworks'].includes(piece.model);
        model.scale.setScalar(piece.scale * (landmark ? 1.93 : 1.26));
        if (piece.model !== 'boat') {
          const foot=seatMiniature(model,ground,material);if(foot)feet.push(foot);
        }
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
        reward.name = `project-${project.id}`; reward.position.fromArray(slot.position); reward.rotation.y = slot.yaw;
        if (source.cinematicTerrain?.buildingPads) {const foot=seatMiniature(reward,ground,material);if(foot)feet.push(foot);}
        village.add(reward);
      }
      const bounds = new THREE.Box3().setFromObject(village), center = bounds.getCenter(new THREE.Vector3());
      const scale = 8.05 / Math.max(source.terrain.size[0], source.terrain.size[1]);
      village.scale.setScalar(scale); village.position.set(-center.x * scale, -bounds.min.y * scale + .55, -center.z * scale - .8);
      village.updateMatrix();
      const coast = (ground.geometry.userData.shore as THREE.Vector3[]).map(p => p.clone().applyMatrix4(village.matrix));
      group.add(village); bakeWorldGroup(group, material);
      ground.geometry.dispose(); signature?.dispose();for(const foot of feet)foot.dispose();
      this.scene.add(group);
      this.villages.push({ chapter: chapter.index, anchor: new THREE.Vector3(), label: new THREE.Vector3(),
        group, coast, hitbox: new THREE.Box3(), material });
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
      pieces.push(new THREE.TubeGeometry(path, 18, 0.035, 4, false));
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
      village.material.color.setHex(chapter?.available ? 0xffffff : 0xb4c5bd);
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
    this.paintChart();
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
    this.paintChart();
  }

  private paintChart(): void {
    if (typeof document === 'undefined') return;
    this.chart ??= new THREE.CanvasTexture(document.createElement('canvas'));
    const canvas = this.chart.image as HTMLCanvasElement;
    canvas.width = Math.ceil(this.stage.rect.width);
    canvas.height = Math.ceil(this.stage.rect.height);
    const shores = this.villages.filter(v => v.group.visible).map(v => v.coast.map(p => {
      const at = p.clone().applyMatrix4(v.group.matrixWorld).project(this.camera);
      return { x: (at.x + 1) * canvas.width / 2, y: (1 - at.y) * canvas.height / 2 };
    }));
    paintIslandChart(canvas, shores);
    this.chart.colorSpace = THREE.SRGBColorSpace;
    this.chart.needsUpdate = true;
    this.scene.background = this.chart;
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
    this.chart?.dispose();
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

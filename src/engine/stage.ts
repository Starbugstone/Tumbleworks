import * as THREE from 'three';
import { studioEnvironment } from './studio';
import { MarbleFactory } from './marbles';
import { useOneTapShadows } from './shadow-filter';
import type { Point3 } from './physics';
import { Finish } from './finish';

/** Where the key light stands from whatever it lights: high, a little left and toward the player, so shadows stay short. */
const KEY_FROM = new THREE.Vector3(-0.42, 1, 0.36).normalize();
/** A lower afternoon sun for the villages, so houses and trestles lay shadows long enough to read. */
const SUN_FROM = new THREE.Vector3(-0.55, 1, 0.42).normalize();
/** The open sea far from a village, and the colour behind everything there. */
export const DEEP_SEA = 0x0e5578;

/** The renderer, environment and shared marble materials survive level transitions. */
export class Stage {
  /** Device pixels per CSS pixel, from the sharpest down; a phone that can't keep up steps down one at a time. */
  static readonly PIXEL_RATIOS = [1.5, 1.25, 1] as const;
  readonly renderer: THREE.WebGLRenderer;
  readonly marbles = new MarbleFactory();
  private readonly environment: THREE.Texture;
  private readonly instancedShadows = new WeakMap<THREE.Scene, THREE.MeshDepthMaterial>();
  private compiled = new WeakSet<THREE.Scene>();
  private readonly keys = new WeakMap<THREE.Scene, THREE.DirectionalLight>();
  private quality = 0;
  /** The finishing pass, while this phone affords it: the first thing given up when frames run slow. */
  private finish: Finish | null = null;
  private bounds: DOMRect | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    useOneTapShadows();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    // Reading back each new shader's log waits for the driver to finish compiling it; development keeps the check.
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.transmissionResolutionScale = 0.5;
    this.environment = studioEnvironment(this.renderer);
    // A software renderer draws every pixel on the processor and cannot afford a second pass; `?fx=1` or `0` overrides.
    const asked = new URLSearchParams(location.search).get('fx');
    const gl = this.renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const software = /swiftshader|llvmpipe|software/i.test(String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : ''));
    if (asked === '1' || (asked !== '0' && !software && this.renderer.capabilities.isWebGL2)) this.finish = new Finish(this.renderer);
  }

  createScene(backdrop: 'studio' | 'arcade' | 'village' = 'studio'): THREE.Scene {
    const scene = new THREE.Scene();
    if (backdrop === 'village') return this.villageScene(scene);
    scene.background = new THREE.Color(0x0e5578);
    scene.environment = this.environment;
    scene.environmentIntensity = 0.7;
    const key = new THREE.DirectionalLight(0xfff0dc, backdrop === 'arcade' ? 2.7 : 3);
    key.position.copy(KEY_FROM).multiplyScalar(26);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 4, far: 50 });
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    // The pale Tube Sort deck shows every shadow edge, so its shadows are the lighter ones.
    key.shadow.intensity = backdrop === 'arcade' ? 0.75 : 0.68;
    this.keys.set(scene, key);
    scene.add(key, key.target, new THREE.HemisphereLight(0xffffff, 0x4a3b30, 0.6));
    return scene;
  }

  /**
   * Warm sun, cool sky. A village's shadows are drawn once and kept: nothing that casts one moves, so the
   * film pays for one lookup per lit pixel and never for a second pass over the village.
   */
  private villageScene(scene: THREE.Scene): THREE.Scene {
    scene.background = new THREE.Color(DEEP_SEA);
    scene.environment = this.environment;
    scene.environmentIntensity = 0.45;
    const sun = new THREE.DirectionalLight(0xffe6c4, 2.6);
    sun.position.copy(SUN_FROM).multiplyScalar(30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
    sun.shadow.intensity = 0.45;
    sun.shadow.autoUpdate = false;
    this.keys.set(scene, sun);
    scene.add(sun, sun.target, new THREE.HemisphereLight(0xcfe4ff, 0x6a5640, 0.6));
    return scene;
  }

  /** A kept shadow map is drawn again with the next frame: call when something that casts one appears or moves. */
  refreshShadows(scene: THREE.Scene): void {
    const key = this.keys.get(scene);
    if (key) key.shadow.needsUpdate = true;
  }

  /**
   * Aims the scene's shadow map at what stands on the board. The same 1024 texels over a board instead of a
   * fixed 26-unit square give finer shadow edges from the one-tap lookup, at no cost per frame.
   */
  fitShadows(scene: THREE.Scene, points: readonly Point3[], margin = 1.2): void {
    const key = this.keys.get(scene);
    if (!key || !points.length) return;
    const bounds = new THREE.Box3().setFromPoints(points.map((point) => new THREE.Vector3(point.x, point.y, point.z)));
    bounds.getCenter(key.target.position);
    key.position.copy(key.target.position).addScaledVector(key.shadow.autoUpdate ? KEY_FROM : SUN_FROM, 60);
    key.target.updateMatrixWorld();
    key.updateMatrixWorld();
    const view = new THREE.Matrix4().lookAt(key.position, key.target.position, key.up).setPosition(key.position).invert();
    const seen = new THREE.Box3();
    const at = new THREE.Vector3();
    for (const point of points) seen.expandByPoint(at.set(point.x, point.y, point.z).applyMatrix4(view));
    const camera = key.shadow.camera;
    Object.assign(camera, { left: seen.min.x - margin, right: seen.max.x + margin, bottom: seen.min.y - margin, top: seen.max.y + margin,
      near: Math.max(1, -seen.max.z - 6), far: -seen.min.z + 12 });
    camera.updateProjectionMatrix();
    key.shadow.needsUpdate = true;
  }

  get pixelRatio(): number { return Math.min(window.devicePixelRatio, Stage.PIXEL_RATIOS[this.quality] ?? 1); }
  get effects(): boolean { return this.finish !== null; }

  /** One step down: the finishing pass first, then the pixel ratios; false once there is nothing left to give. */
  lowerQuality(): boolean {
    if (this.finish) {
      this.finish.dispose();
      this.finish = null;
      // Every scene's shaders were compiled for the finishing target; the next draw compiles them for the canvas.
      this.compiled = new WeakSet();
      return true;
    }
    while (this.quality < Stage.PIXEL_RATIOS.length - 1) {
      const before = this.pixelRatio;
      this.quality++;
      if (this.pixelRatio < before) {
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
        return true;
      }
    }
    return false;
  }

  /**
   * Draws a scene, compiling every shader it holds the first time, hidden effects included, so the first
   * completion burst of a level doesn't stall on a compile at the moment it should pay off.
   */
  draw(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.compiled.has(scene)) {
      // Three's default depth material alternates shader variants between plain and instanced casters.
      // Keep one scene-owned instanced variant, including after clearLevel removes its meshes.
      // Every caster is built before this first draw, including waiting lorries and hidden effects.
      scene.traverse((object) => {
        if (!(object instanceof THREE.InstancedMesh) || !object.castShadow || object.customDepthMaterial) return;
        let depth = this.instancedShadows.get(scene);
        if (!depth) { depth = new THREE.MeshDepthMaterial(); this.instancedShadows.set(scene, depth); }
        object.customDepthMaterial = depth;
      });
      if (this.finish) this.finish.compile(scene, camera); else this.renderer.compile(scene, camera);
      this.compiled.add(scene);
    }
    if (this.finish && camera instanceof THREE.PerspectiveCamera) this.finish.render(scene, camera);
    else this.renderer.render(scene, camera);
  }

  /** Where the canvas sits on the page. It is fixed to the viewport, so only a resize moves it. */
  get rect(): DOMRect {
    this.bounds ??= this.canvas.getBoundingClientRect();
    return this.bounds;
  }

  resized(): void { this.bounds = null; }

  disposeScene(scene: THREE.Scene): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
        }
      }
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
      material.dispose();
    }
    this.instancedShadows.get(scene)?.dispose();
    this.instancedShadows.delete(scene);
    scene.clear();
  }
}

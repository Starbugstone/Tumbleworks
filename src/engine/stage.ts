import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { woodTexture } from '../view/art';
import { MarbleFactory } from './marbles';
import { useOneTapShadows } from './shadow-filter';

/** The renderer, lighting and toy materials survive every level transition. */
export class Stage {
  /** Device pixels per CSS pixel, from the sharpest down; a phone that can't keep up steps down one at a time. */
  static readonly PIXEL_RATIOS = [1.25, 1] as const;
  readonly renderer: THREE.WebGLRenderer;
  readonly marbles = new MarbleFactory();
  private readonly environment: THREE.Texture;
  private readonly tableMaterial: THREE.MeshStandardMaterial;
  private readonly compiled = new WeakSet<THREE.Scene>();
  private quality = 0;
  private bounds: DOMRect | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    useOneTapShadows();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    // Reading back each new shader's log waits for the driver to finish compiling it; development keeps the check.
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.transmissionResolutionScale = 0.5;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.tableMaterial = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.62, envMapIntensity: 0.35 });
  }

  createScene(backdrop: 'wood' | 'studio' | 'arcade' = 'wood'): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backdrop === 'wood' ? 0x6e4a2b : backdrop === 'arcade' ? 0x0b172b : 0x1f2650);
    scene.environment = this.environment;
    scene.environmentIntensity = backdrop === 'wood' ? 0.38 : 0.5;
    const key = new THREE.DirectionalLight(0xfff0dc, backdrop === 'arcade' ? 2.3 : 3.2);
    key.position.set(-7, 22, 11);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 4, far: 50 });
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    scene.add(key, new THREE.HemisphereLight(0xffffff, backdrop === 'wood' ? 0x8a5a30 : 0x2b3473, backdrop === 'wood' ? 0.35 : 0.55));
    if (backdrop === 'wood') {
      const table = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), this.tableMaterial);
      table.rotation.x = -Math.PI / 2;
      table.receiveShadow = true;
      scene.add(table);
    } else {
      // A soft studio floor far below the platform, so the platform reads as a chunky toy on a stand.
      const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: 0x2a3366, roughness: 0.95 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -6;
      floor.receiveShadow = true;
      scene.add(floor);
    }
    return scene;
  }

  get pixelRatio(): number { return Math.min(window.devicePixelRatio, Stage.PIXEL_RATIOS[this.quality] ?? 1); }

  /** One step down the pixel ratios; false once there is nothing left to give. */
  lowerQuality(): boolean {
    while (this.quality < Stage.PIXEL_RATIOS.length - 1) {
      const before = this.pixelRatio;
      this.quality++;
      if (this.pixelRatio < before) {
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
        return true;
      }
    }
    return this.marbles.useSolidGlass();
  }

  /**
   * Draws a scene, compiling every shader it holds the first time, hidden effects included, so the first
   * completion burst of a level doesn't stall on a compile at the moment it should pay off.
   */
  draw(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.compiled.has(scene)) {
      this.renderer.compile(scene, camera);
      this.compiled.add(scene);
    }
    this.renderer.render(scene, camera);
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
          if (material !== this.tableMaterial) materials.add(material);
        }
      }
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
      material.dispose();
    }
    scene.clear();
  }
}

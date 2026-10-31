import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { woodTexture } from '../view/art';
import { MarbleFactory } from './marbles';

/** The renderer, lighting and toy materials survive every level transition. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly marbles = new MarbleFactory();
  private readonly environment: THREE.Texture;
  private readonly tableMaterial: THREE.MeshStandardMaterial;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
    key.shadow.radius = 4;
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

  lowerQuality(): boolean {
    if (this.renderer.getPixelRatio() > 1) {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
      return true;
    }
    return this.marbles.useSolidGlass();
  }

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

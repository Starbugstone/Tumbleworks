import * as THREE from 'three';

/** View-space distances a scene keeps sharp, and how far beyond them the blur takes to reach full strength. */
export interface Focus { near: number; far: number; falloff: number }

const VERTEX = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/**
 * One pass does everything. The scene's own mip chain is the blur: distance from the focus range picks a
 * coarser level, which is the miniature look, and whatever is still brighter than white in the coarse
 * levels spills back as glow. No extra targets and no blur passes.
 */
const FRAGMENT = /* glsl */`
#include <common>
#include <packing>
uniform sampler2D map;
uniform sampler2D depthMap;
uniform vec2 clip;
uniform vec3 focus;
uniform float glow;
varying vec2 vUv;
void main() {
  float distance = -perspectiveDepthToViewZ(texture2D(depthMap, vUv).x, clip.x, clip.y);
  float away = max(focus.x - distance, distance - focus.y) / focus.z;
  vec3 color = textureLod(map, vUv, clamp(away, 0.0, 1.0) * 3.2).rgb;
  vec3 spill = max(textureLod(map, vUv, 3.0).rgb - 1.0, 0.0) + max(textureLod(map, vUv, 5.0).rgb - 1.0, 0.0);
  color += spill * glow;
  vec2 corner = vUv - 0.5;
  color *= 1.0 - dot(corner, corner) * 0.42;
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** The finishing pass: miniature depth blur, glow and a soft vignette, for phones that can afford them. */
export class Finish {
  private target: THREE.WebGLRenderTarget | null = null;
  private readonly size = new THREE.Vector2();
  private readonly material = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT, depthTest: false, depthWrite: false,
    uniforms: { map: { value: null }, depthMap: { value: null }, clip: { value: new THREE.Vector2(1, 100) },
      focus: { value: new THREE.Vector3(0, 1000, 1) }, glow: { value: 0.3 } },
  });
  private readonly quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.quad.frustumCulled = false;
  }

  /** The target the scene is drawn into, at the canvas's current size. */
  private buffer(): THREE.WebGLRenderTarget {
    this.renderer.getDrawingBufferSize(this.size);
    if (!this.target || this.target.width !== this.size.x || this.target.height !== this.size.y) {
      this.target?.dispose();
      this.target = new THREE.WebGLRenderTarget(this.size.x, this.size.y, {
        type: THREE.HalfFloatType, samples: 4, generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
        depthTexture: new THREE.DepthTexture(this.size.x, this.size.y),
      });
    }
    return this.target;
  }

  /** Shaders differ between the canvas and a target, so a scene compiles against the one it will be drawn into. */
  compile(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.setRenderTarget(this.buffer());
    this.renderer.compile(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.compile(this.quad, this.camera);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    const target = this.buffer();
    this.renderer.setRenderTarget(target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    const { uniforms } = this.material;
    uniforms['map']!.value = target.texture;
    uniforms['depthMap']!.value = target.depthTexture;
    (uniforms['clip']!.value as THREE.Vector2).set(camera.near, camera.far);
    const focus = scene.userData['focus'] as Focus | undefined;
    (uniforms['focus']!.value as THREE.Vector3).set(focus?.near ?? 0, focus?.far ?? camera.far, focus?.falloff ?? 1);
    this.renderer.render(this.quad, this.camera);
  }

  dispose(): void {
    this.target?.dispose();
    this.target = null;
  }
}

/** Keeps everything between the nearest and farthest of these points sharp; the world beyond them softens. */
export function focusOn(scene: THREE.Scene, camera: THREE.Camera, points: readonly { x: number; y: number; z: number }[], falloff = 14): void {
  camera.updateMatrixWorld();
  const at = new THREE.Vector3();
  let near = Infinity, far = -Infinity;
  for (const point of points) {
    const distance = -at.set(point.x, point.y, point.z).applyMatrix4(camera.matrixWorldInverse).z;
    near = Math.min(near, distance); far = Math.max(far, distance);
  }
  scene.userData['focus'] = { near: near - 2, far: far + 2, falloff } satisfies Focus;
}

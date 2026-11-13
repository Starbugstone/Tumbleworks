import * as THREE from 'three';

/**
 * Moulded-toy shading, shared by every plastic on a board. Three things a flat lit colour lacks:
 * a soft light along every rounded edge, sides a shade deeper than tops, and on the fixed body the
 * darkening where a floor meets a wall, read from a small top-down map baked once per board.
 */
const NEUTRAL = Object.assign(new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1), { needsUpdate: true });
const occlusion: { value: THREE.Texture } = { value: NEUTRAL };
/** World x and z of the map's first corner, then one over its width and depth. */
const area = { value: new THREE.Vector4(0, 0, 1, 1) };

const WORLD = /* glsl */`
  vec4 candyAt = vec4(transformed, 1.0);
  vec3 candyUp = objectNormal;
  #ifdef USE_INSTANCING
    candyAt = instanceMatrix * candyAt;
    candyUp = mat3(instanceMatrix) * candyUp;
  #endif
  vCandyAt = (modelMatrix * candyAt).xyz;
  vCandyUp = normalize(mat3(modelMatrix) * candyUp);`;

const SHADE = /* glsl */`
  float candyFacing = normalize(vCandyUp).y;
  diffuseColor.rgb *= mix(0.8, 1.0, smoothstep(-0.2, 0.85, candyFacing));
  #ifdef CANDY_GROUND
    vec2 candyUv = (vCandyAt.xz - uCandyArea.xy) * uCandyArea.zw;
    float candyInside = step(0.0, candyUv.x) * step(candyUv.x, 1.0) * step(0.0, candyUv.y) * step(candyUv.y, 1.0);
    float candyShade = 0.5 + texture2D(uCandyOcclusion, candyUv).r;
    diffuseColor.rgb *= mix(1.0, candyShade, candyInside * smoothstep(0.4, 0.9, candyFacing));
  #endif`;

const RIM = /* glsl */`
  float candyRim = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0);
  outgoingLight += candyRim * 0.2 * (diffuseColor.rgb * 0.6 + 0.4);`;

/** Gives a standard material the toy shading. `ground` also takes the baked floor shading: fixed bodies only. */
export function candy<T extends THREE.MeshStandardMaterial>(material: T, ground = false): T {
  if (ground) material.defines = { ...material.defines, CANDY_GROUND: '' };
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uCandyOcclusion'] = occlusion;
    shader.uniforms['uCandyArea'] = area;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCandyAt;\nvarying vec3 vCandyUp;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>\n${WORLD}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCandyAt;\nvarying vec3 vCandyUp;\nuniform sampler2D uCandyOcclusion;\nuniform vec4 uCandyArea;')
      .replace('#include <color_fragment>', `#include <color_fragment>\n${SHADE}`)
      .replace('#include <opaque_fragment>', `${RIM}\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => (ground ? 'candy-ground' : 'candy');
  return material;
}

const SIZE = 160;
const HEIGHT = new THREE.ShaderMaterial({
  uniforms: { uRange: { value: new THREE.Vector2(0, 1) } },
  vertexShader: /* glsl */`
    varying float vHeight;
    void main() {
      vec4 at = modelMatrix * vec4(position, 1.0);
      vHeight = at.y;
      gl_Position = projectionMatrix * viewMatrix * at;
    }`,
  fragmentShader: /* glsl */`
    uniform vec2 uRange;
    varying float vHeight;
    void main() {
      float v = clamp((vHeight - uRange.x) / (uRange.y - uRange.x), 0.0, 1.0) * 255.0;
      gl_FragColor = vec4(floor(v) / 255.0, fract(v), 0.0, 1.0);
    }`,
});

function blur(source: Float32Array, radius: number): Float32Array {
  const pass = (from: Float32Array, stride: number, other: number): Float32Array => {
    const to = new Float32Array(from.length);
    for (let line = 0; line < SIZE; line++) {
      for (let i = 0; i < SIZE; i++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) sum += from[line * other + Math.min(SIZE - 1, Math.max(0, i + k)) * stride]!;
        to[line * other + i * stride] = sum / (radius * 2 + 1);
      }
    }
    return to;
  };
  return pass(pass(source, 1, SIZE), SIZE, 1);
}

/**
 * Looks straight down at a board's fixed body once, and keeps where its floors sit below their
 * neighbours (darker) or stand proud of them (a touch lighter). Costs one small draw and one read at
 * load, then one texture lookup on the body; nothing per frame.
 */
export function bakeOcclusion(renderer: THREE.WebGLRenderer, bodies: readonly THREE.Mesh[], bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
  const low = -1.5, high = 9;
  const scene = new THREE.Scene();
  for (const body of bodies) {
    body.updateWorldMatrix(true, false);
    const copy = new THREE.Mesh(body.geometry, HEIGHT);
    copy.matrixAutoUpdate = false;
    copy.matrix.copy(body.matrixWorld);
    copy.frustumCulled = false;
    scene.add(copy);
  }
  const width = bounds.maxX - bounds.minX, depth = bounds.maxZ - bounds.minZ;
  const camera = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0.1, high - low + 1);
  camera.position.set((bounds.minX + bounds.maxX) / 2, high + 0.5, (bounds.minZ + bounds.maxZ) / 2);
  camera.up.set(0, 0, -1);
  camera.lookAt(camera.position.x, 0, camera.position.z);
  (HEIGHT.uniforms['uRange']!.value as THREE.Vector2).set(low, high);
  const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { depthBuffer: true });
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const before = renderer.getRenderTarget();
  const clear = renderer.getClearColor(new THREE.Color());
  const alpha = renderer.getClearAlpha();
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
  renderer.setRenderTarget(before);
  renderer.setClearColor(clear, alpha);
  target.dispose();

  const heights = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < heights.length; i++) heights[i] = low + (pixels[i * 4]! + pixels[i * 4 + 1]! / 255) / 255 * (high - low);
  // Two reaches: a tight one for the crease at the foot of a wall, a wide one for the soft fall-off beyond it.
  const near = blur(heights, 3), far = blur(heights, 9);
  const shade = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < shade.length; i++) {
    const sunk = Math.min(2.5, Math.max(0, near[i]! - heights[i]!)) * 0.5 + Math.min(2.5, Math.max(0, far[i]! - heights[i]!)) * 0.3;
    const proud = Math.min(0.5, Math.max(0, heights[i]! - near[i]!));
    shade[i] = Math.round(255 * Math.min(0.62, Math.max(0.12, 0.5 - sunk * 0.38 + proud * 0.2)));
  }
  // One map for the life of the page, rewritten for each board: a level being torn down may still be drawn
  // once after the next is built, and would bring a disposed map back with nothing left to free it.
  if (occlusion.value === NEUTRAL) {
    const map = new THREE.DataTexture(shade, SIZE, SIZE, THREE.RedFormat);
    map.minFilter = map.magFilter = THREE.LinearFilter;
    occlusion.value = map;
  } else ((occlusion.value as THREE.DataTexture).image.data as Uint8Array).set(shade);
  occlusion.value.needsUpdate = true;
  // Row 0 of what was read is the near edge (largest z): the camera's up is away from the player.
  area.value.set(bounds.minX, bounds.maxZ, 1 / width, -1 / depth);
}

/**
 * Two-tone moulding: paints a geometry darker at its foot and lighter at its lip, as a multiplier on the
 * material's colour. Use with a material whose `vertexColors` is on.
 */
export function moulded<T extends THREE.BufferGeometry>(geometry: T, foot = 0.6, lip = 1.16): T {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) - min.y) / Math.max(1e-6, max.y - min.y);
    // Most of the rise happens low down, so the lit top stays one clean colour.
    const tone = foot + (lip - foot) * (1 - (1 - t) * (1 - t));
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = tone;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BoardBackdrop } from './yard-backdrop';

export type CounterStock = 'timber' | 'slate' | 'tile';
export interface CounterFinish { stock: CounterStock; stain: string }

/** A small repeat in physical board units preserves the edge of every joint at phone size. */
function counterMap(finish: CounterFinish): THREE.CanvasTexture {
  const size = 768;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = finish.stain;
  ctx.fillRect(0, 0, size, size);
  let seed = 92527;
  const sample = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const wood = finish.stock === 'timber', courses = wood ? 8 : 4;
  const pitch = size / courses;
  for (let row = 0; row < courses; row++) {
    const y = row * pitch;
    ctx.fillStyle = row % 3 === 0 ? 'rgba(255,238,204,.035)' : 'rgba(27,20,23,.035)';
    ctx.fillRect(0, y, size, pitch);
    const joint = Math.round(size * (.12 + .76 * sample()));
    ctx.strokeStyle = 'rgba(28,26,29,.38)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, y + 1); ctx.lineTo(size, y + 1);
    ctx.moveTo(joint, y); ctx.lineTo(joint, y + pitch); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,239,205,.27)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, y + 3); ctx.lineTo(size, y + 3);
    ctx.moveTo(joint + 2, y + 3); ctx.lineTo(joint + 2, y + pitch); ctx.stroke();
    if (wood) {
      const knot = size * (.15 + sample() * .7), knotY = y + pitch * (.35 + sample() * .3);
      for (let i = 0; i < 24; i++) {
        const v = y + 5 + sample() * (pitch - 10), d = (v - knotY) / pitch;
        const spread = Math.exp(-Math.abs(d) * 8) * Math.sign(d) * 8;
        ctx.beginPath();
        for (let x = 0; x <= size; x += 8) {
          const across = (x - knot) / 80;
          const h = v + Math.sin(x * 2 * Math.PI / size + row) * 2 + spread * Math.exp(-across * across);
          if (x === 0) ctx.moveTo(x, h); else ctx.lineTo(x, h);
        }
        ctx.strokeStyle = i % 3 ? 'rgba(37,25,24,.09)' : 'rgba(255,235,202,.12)';
        ctx.lineWidth = .65 + sample(); ctx.stroke();
      }
      for (const side of [-1, 1]) for (const offset of [.24, .76]) {
        const x = joint + side * 7, z = y + offset * pitch;
        ctx.fillStyle = 'rgba(42,29,27,.58)'; ctx.beginPath(); ctx.ellipse(x,z,2.1,2.7,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle = 'rgba(222,197,153,.52)'; ctx.fillRect(x-1,z+1,2,1);
      }
    } else {
      for (let i = 0; i < (finish.stock === 'slate' ? 1000 : 180); i++) {
        const x = sample() * size, z = y + sample() * pitch;
        ctx.fillStyle = i % 2 ? 'rgba(22,36,43,.11)' : 'rgba(255,244,217,.13)';
        ctx.fillRect(x, z, 1 + sample() * 3, 1);
      }
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 2;
  return map;
}

export function counterGeometry(halfWidth: number, back: number, front: number, top: number): THREE.BufferGeometry {
  const center = (back + front) / 2;
  const side = halfWidth + .48;
  const rear = back - 1.2, nose = front + .95;
  const outline = new THREE.Shape();
  // Bevelled quay corners keep the shore visible at the two ends of the instrument.
  outline.moveTo(-side - .43, -nose + .55);
  outline.lineTo(-side + .12, -nose);
  outline.lineTo(side - .9, -nose);
  outline.lineTo(side, -nose + .9);
  outline.lineTo(side, -rear - .62);
  outline.lineTo(side - .62, -rear);
  outline.lineTo(-side - .12, -rear);
  outline.lineTo(-side - .43, -rear - .31);
  outline.closePath();
  const worktop = new THREE.ExtrudeGeometry(outline, {depth: .38, bevelThickness: .055, bevelSize: .055, bevelSegments: 2});
  worktop.rotateX(-Math.PI / 2).translate(0, top - .435, 0);
  const outside = new THREE.PlaneGeometry(72, 72).rotateX(-Math.PI / 2).translate(0, top - 1.2, center).toNonIndexed();
  for (const geometry of [worktop, outside]) geometry.clearGroups();
  const combined = mergeGeometries([worktop, outside])!;
  const tableVertices = worktop.getAttribute('position').count;
  worktop.dispose(); outside.dispose();
  const positions = combined.getAttribute('position'), normals = combined.getAttribute('normal'), uv = combined.getAttribute('uv');
  const surface = new Float32Array(positions.count);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const isTable = i < tableVertices;
    surface[i] = isTable ? 1 : 0;
    if (!isTable) uv.setXY(i, x / 72 + .5, .5 - (z - center) / 72);
    else if (normals.getY(i) > .5) uv.setXY(i, (x + z * .06) / 7.5, (z - x * .06) / 7.5);
    else uv.setXY(i, (x + z) / 7.5, y / 7.5);
  }
  combined.setAttribute('countertop', new THREE.BufferAttribute(surface, 1));
  return combined;
}

/** One lit countertop and its distant unshadowed surround share a single draw. */
export function boardCounter(halfWidth: number, back: number, front: number, top: number, backdrop: BoardBackdrop,
  time: { value: number }): { mesh: THREE.Mesh; surround: THREE.Texture } {
  const image = document.createElement('canvas');
  image.width = image.height = backdrop.paint ? 512 : 8;
  const ctx = image.getContext('2d')!;
  if (backdrop.paint) backdrop.paint(ctx, image.width, 72);
  else {
    const wash = ctx.createLinearGradient(0,0,8,8);
    wash.addColorStop(0,'#295b65'); wash.addColorStop(1,'#518b88');
    ctx.fillStyle = wash;ctx.fillRect(0,0,8,8);
  }
  const surround = new THREE.CanvasTexture(image);
  surround.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ map: counterMap(backdrop.finish), roughness: .84 });
  material.onBeforeCompile = shader => {
    shader.uniforms['outsideMap'] = {value: surround};
    shader.uniforms['counterTime'] = time;
    shader.uniforms['coastal'] = { value: backdrop.kind === 'water' ? 1 : 0 };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float countertop; varying float onCounter;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nonCounter=countertop;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float onCounter; uniform sampler2D outsideMap; uniform float counterTime; uniform float coastal;')
      .replace('#include <map_fragment>', `if (onCounter > .5) {
        diffuseColor *= texture2D(map, vMapUv);
      } else {
        vec2 p = vMapUv * 72.;
        float swell = sin(p.y * 3.1 + p.x * 1.5 + sin(p.x * 1.2 + counterTime * .28) + counterTime * .51);
        float crest = smoothstep(.84, 1., swell) * smoothstep(.12, .91, sin(p.x * 2.3 - p.y + counterTime * .25));
        diffuseColor.rgb = texture2D(outsideMap, vMapUv).rgb + coastal * vec3(.036,.065,.059) * crest;
      }`)
      .replace('#include <opaque_fragment>', 'if (onCounter < .5) outgoingLight = diffuseColor.rgb;\n#include <opaque_fragment>');
  };
  const mesh = new THREE.Mesh(counterGeometry(halfWidth, back, front, top), material);
  mesh.name = 'island-work-surface';
  mesh.receiveShadow = true;
  mesh.userData['top'] = top;
  return { mesh, surround };
}

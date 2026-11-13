import * as THREE from 'three';
import type { BeltPath } from '../engine/belt-path';

/** Belt plates: a seam every plate, a soft bevel after it, and a faint centre line. Low contrast on purpose. */
function plateTexture(base: string, seam: string, bevel: string, edge: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Belt surface needs a canvas');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 128);
  // A darker gutter along both edges, so the plate reads as a strip set into the channel.
  ctx.fillStyle = edge; ctx.fillRect(0, 0, 256, 7); ctx.fillRect(0, 121, 256, 7);
  // One hinge seam per repeat, with a lighter bevel on the plate behind it.
  ctx.fillStyle = seam; ctx.fillRect(0, 7, 5, 114);
  ctx.fillStyle = bevel; ctx.fillRect(5, 7, 4, 114);
  // A quiet chevron in the middle of the plate shows the direction of travel.
  ctx.strokeStyle = bevel; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(118, 40); ctx.lineTo(142, 64); ctx.lineTo(118, 88); ctx.stroke();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = 4;
  return map;
}

/**
 * The moving belt itself: a textured strip laid along the path whose plates scroll with belt travel.
 * One mesh and one texture offset per frame, so showing motion costs nothing per marble.
 */
export class BeltSurface {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly map: THREE.CanvasTexture;
  /** With reduced motion the plates hold still; the marbles and cargo still show the belt is running. */
  private readonly still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** 0 at rest; a streak or a win lifts the plates and chevrons toward their own colours, lit from within. */
  setEnergy(value: number): void { this.mesh.material.emissiveIntensity = this.still ? 0 : value * 0.85; }

  constructor(path: BeltPath, halfWidth: number, floorY: number, readonly plateLength: number,
    palette = { base: '#2a1742', seam: '#170b27', bevel: '#40245f', edge: '#1c0f2e' }) {
    this.map = plateTexture(palette.base, palette.seam, palette.bevel, palette.edge);
    const samples = 320;
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= samples; i++) {
      const d = i / samples * path.length;
      for (const side of [-1, 1]) {
        const p = path.point(d, side * halfWidth);
        positions.push(p.x, floorY + p.y + 0.008, p.z);
        uvs.push(d / plateLength, side < 0 ? 0 : 1);
      }
      if (i === samples) continue;
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ map: this.map, emissiveMap: this.map, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.78, metalness: 0, envMapIntensity: 0.4, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  /** The belt's own travel, so the plates move with the marbles riding them. */
  setTravel(distance: number): void {
    if (this.still) return;
    const u = distance / this.plateLength;
    this.map.offset.x = -(u - Math.floor(u));
  }
}

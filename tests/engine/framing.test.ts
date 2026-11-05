import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { frameBoard } from '../../src/engine/framing';

const bounds = [
  { x: -5.6, y: 11.8, z: -10 }, { x: 5.6, y: 11.8, z: -10 },
  { x: -6.2, y: 2.1, z: 0.5 }, { x: 6.2, y: 2.1, z: 0.5 },
  { x: -1.8, y: 0, z: 7 }, { x: 1.8, y: 0, z: 7 },
];

describe('shared board framing', () => {
  it.each([[1365,900],[375,690]])('keeps the full 3D board out of the HUD at %sx%s', (width,height) => {
    const camera = new THREE.PerspectiveCamera(40,1,0.1,150);
    frameBoard(camera,width,height,bounds,new THREE.Vector3(0,.72,.69));
    const compact = height<600&&width>600;
    const phone = width <= 600;
    const pixels: { x: number; y: number }[] = [];
    for(const p of bounds) {
      const screen = new THREE.Vector3(p.x,p.y,p.z).project(camera);
      const x = (screen.x+1)*width/2;
      const y = (1-screen.y)*height/2;
      pixels.push({ x, y });
      expect(x).toBeGreaterThanOrEqual(phone ? 6 : 14);
      expect(x).toBeLessThanOrEqual(width - (phone ? 6 : 14));
      expect(y).toBeGreaterThanOrEqual(compact ? 56 : phone ? 52 : 64);
      expect(y).toBeLessThanOrEqual(height - (compact ? 64 : phone ? 80 : 92));
      expect(screen.z).toBeGreaterThan(-1);
      expect(screen.z).toBeLessThan(1);
    }
    const left = Math.min(...pixels.map(p => p.x)), right = Math.max(...pixels.map(p => p.x));
    const top = Math.min(...pixels.map(p => p.y)), bottom = Math.max(...pixels.map(p => p.y));
    const safeTop = compact ? 56 : phone ? 52 : 64;
    const safeBottom = height - (compact ? 64 : phone ? 80 : 92);
    expect((left + right) / 2).toBeCloseTo(width / 2, 5);
    expect((top + bottom) / 2).toBeCloseTo((safeTop + safeBottom) / 2, 5);
    expect(Math.max((right - left) / (width - (phone ? 12 : 28)), (bottom - top) / (safeBottom - safeTop))).toBeGreaterThan(0.94);
  });
});

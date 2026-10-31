import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { frameBoard } from '../../src/engine/framing';

const bounds = [
  { x: -5.6, y: 11.8, z: -10 }, { x: 5.6, y: 11.8, z: -10 },
  { x: -6.2, y: 2.1, z: 0.5 }, { x: 6.2, y: 2.1, z: 0.5 },
  { x: -1.8, y: 0, z: 7 }, { x: 1.8, y: 0, z: 7 },
];

describe('shared board framing', () => {
  it.each([[1365,900],[390,844],[320,700],[844,390]])('keeps the full 3D board out of the HUD at %sx%s', (width,height) => {
    const camera = new THREE.PerspectiveCamera(40,1,0.1,150);
    frameBoard(camera,width,height,bounds,new THREE.Vector3(0,.72,.69));
    const compact = height<600&&width>600;
    for(const p of bounds) {
      const screen = new THREE.Vector3(p.x,p.y,p.z).project(camera);
      const x = (screen.x+1)*width/2;
      const y = (1-screen.y)*height/2;
      expect(x).toBeGreaterThanOrEqual(14);
      expect(x).toBeLessThanOrEqual(width-14);
      expect(y).toBeGreaterThanOrEqual(compact ? 56 : 64);
      expect(y).toBeLessThanOrEqual(height - (compact ? 64 : 92));
      expect(screen.z).toBeGreaterThan(-1);
      expect(screen.z).toBeLessThan(1);
    }
  });
});

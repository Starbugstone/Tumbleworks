import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import kitRaw from '../../assets/world-3d/kit-runtime.json?raw';
import { registerWorldKit, WorldAssets } from '../../src/view/world-assets';
import { WorldRube } from '../../src/view/world-rube';
import { createRubeSample } from '../../src/world/rube-sequence';

describe('the rendered causal machine', () => {
  it('seats the incoming valley connection on the actual cradle while it tips', () => {
    const assets = new WorldAssets(), material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const rig = new WorldRube(assets.anchors, assets, material), scene = new THREE.Scene(); scene.add(...rig.groups);
    try {
      const point = new THREE.Vector3();
      for (const time of [1.8, 1.9, 2, 2.2, 2.35]) {
        rig.handoff(time, point); scene.updateMatrixWorld(true);
        const cup = scene.getObjectByName('rube-cradle-cup')!;
        expect(point.distanceTo(cup.localToWorld(new THREE.Vector3(0, 0.3, 0)))).toBeLessThan(0.00001);
      }
    } finally { rig.dispose(); assets.dispose(); material.dispose(); }
  });
  it('carries the marble on the real cradle, catapult cup and counterrotating bucket', () => {
    registerWorldKit(kitRaw); const assets = new WorldAssets(); const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const rig = new WorldRube(assets.anchors, assets, material); const scene = new THREE.Scene(); scene.add(...rig.groups);
    const actual = new THREE.Vector3();
    for (const [name, times, offset] of [
      ['rube-cradle-cup', [0, 2.16, 2.22, 2.299], 0.3],
      ['rube-catapult-cup', [10.1, 10.56, 10.575, 10.599, 10.6], 0.3],
      ['rube-bucket-cup-0', [14.7, 15, 15.4, 15.9, 16], 0],
    ] as const) for (const time of times) {
      rig.apply(time); rig.sample(time, actual); scene.updateMatrixWorld(true);
      const cup = scene.getObjectByName(name)!; const carried = cup.localToWorld(new THREE.Vector3(0, offset, 0));
      expect(actual.distanceTo(carried), `${name} at ${time}`).toBeLessThan(0.00001);
    }
    for (const time of [10.55, 10.57, 10.6, 11]) {
      rig.apply(time); scene.updateMatrixWorld(true);
      const beam = scene.getObjectByName('rube-catapult')!; const weight = scene.getObjectByName('rube-counterweight')!;
      const seat = beam.localToWorld(new THREE.Vector3(0.85, 0.06, 0));
      const bottom = weight.localToWorld(new THREE.Vector3(0, -0.275, 0));
      expect(seat.distanceTo(bottom)).toBeLessThan(0.00001);
    }
    rig.dispose(); assets.dispose(); material.dispose();
  });

  it('shares its swept floor with the marble route and keeps all ten construction groups', () => {
    registerWorldKit(kitRaw); const assets = new WorldAssets(); const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const rig = new WorldRube(assets.anchors, assets, material); const scene = new THREE.Scene(); scene.add(...rig.groups); scene.updateMatrixWorld(true);
    expect(rig.groups).toHaveLength(10); expect(rig.triangles).toBeLessThan(25000);
    const loop = rig.route.pieces.find(piece => piece.kind === 'loop')!; const point = loop.points[Math.floor(loop.points.length / 2)]!;
    const normal = new THREE.Vector3(point.nx, point.ny, point.nz);
    const side = new THREE.Vector3(point.tx, point.ty, point.tz).cross(normal).normalize();
    const depth = Math.sqrt((0.3 + 0.055) ** 2 - 0.22 ** 2);
    for (const direction of [-1, 1]) {
      const towardRail = normal.clone().multiplyScalar(-depth).addScaledVector(side, direction * 0.22).normalize();
      const ray = new THREE.Raycaster(new THREE.Vector3(point.x, point.y, point.z), towardRail, 0, 0.5);
      const hit = ray.intersectObject(rig.groups[loop.stop]!, true)[0]; expect(hit?.distance).toBeCloseTo(0.3, 2);
    }
    const sample = createRubeSample(); const position = new THREE.Vector3(); rig.sample(15.4, position); rig.route.sample(15.4, sample);
    expect(position.toArray()).toEqual([sample.x, sample.y, sample.z]);
    const rest = scene.getObjectByName('rube-top')!.rotation.y; rig.apply(8.05); expect(scene.getObjectByName('rube-top')!.rotation.y).toBe(rest);
    rig.apply(8.35); expect(scene.getObjectByName('rube-top')!.rotation.y).not.toBe(rest);
    rig.reset(); expect(scene.getObjectByName('rube-top')!.rotation.y).toBe(rest);
    let meshes = 0; scene.traverse(object => { if (object instanceof THREE.Mesh) meshes++; });
    console.log(JSON.stringify({ rubeTriangles: rig.triangles, meshes }));
    rig.dispose(); assets.dispose(); material.dispose();
  });
});

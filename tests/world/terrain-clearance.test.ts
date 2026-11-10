import { expect, it } from 'vitest';
import * as THREE from 'three';
import { WorldAssets } from '../../src/view/world-assets';
import { RubeRoute, createRubeSample, RUBE_DURATION, RUBE_RADIUS } from '../../src/world/rube-sequence';

it('keeps the whole marble above the actual Blender terrain throughout the authored run', () => {
  const assets = new WorldAssets(), material = new THREE.MeshBasicMaterial();
  const terrain = assets.terrain(material); terrain.updateMatrixWorld(true);
  const route = new RubeRoute(assets.anchors), sample = createRubeSample();
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  const failures: { seconds: number; ground: number; marbleBottom: number }[] = [];
  let observations = 0;
  try {
    for (let frame = 0; frame <= RUBE_DURATION * 120; frame++) {
      const seconds = frame / 120;
      route.sample(seconds, sample); ray.ray.origin.set(sample.x, sample.y + 20, sample.z);
      const ground = ray.intersectObject(terrain, true)[0]?.point.y;
      if (ground === undefined) continue;
      observations++;
      if (sample.y - RUBE_RADIUS < ground - 0.002) failures.push({ seconds, ground, marbleBottom: sample.y - RUBE_RADIUS });
    }
    expect(observations).toBeGreaterThan(2500);
    expect(failures, 'terrain must not enter the marble; floor contact within 2mm is allowed').toEqual([]);
  } finally { assets.dispose(); material.dispose(); }
});

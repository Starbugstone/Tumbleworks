import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import kitRaw from '../../public/models/world-kit.json?raw';
import { registerWorldKit, WorldAssets } from '../../src/view/world-assets';
import { createProjectReward } from '../../src/view/project-rewards';
import type { ProjectReward } from '../../src/world/workshop-projects';

const rewards: readonly ProjectReward[] = ['gantry', 'bells', 'waterwheel', 'cistern', 'gate', 'windmill', 'terrace'];
describe('permanent Atelier rewards', () => {
  it('builds seven distinct grounded compositions without campaign mechanisms', () => {
    registerWorldKit(kitRaw);
    const assets = new WorldAssets(); const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const silhouettes = new Set<string>();
    for (const reward of rewards) {
      const group = createProjectReward(reward, assets, material);
      const bounds = new THREE.Box3().setFromObject(group); const size = bounds.getSize(new THREE.Vector3());
      expect(bounds.isEmpty()).toBe(false); expect(bounds.min.y).toBeCloseTo(0, 4);
      expect(size.x).toBeLessThanOrEqual(2.1); expect(size.z).toBeLessThanOrEqual(2.1); expect(size.y).toBeLessThanOrEqual(2.5);
      expect(size.y).toBeGreaterThan(1);
      silhouettes.add(size.toArray().map(value => value.toFixed(3)).join(','));
    }
    expect(silhouettes.size).toBe(7); assets.dispose(); material.dispose();
  });
  it('keeps independently earned instances separate while reusing asset geometry', () => {
    registerWorldKit(kitRaw);
    const assets = new WorldAssets(); const material = new THREE.MeshStandardMaterial();
    const first = createProjectReward('gantry', assets, material); const second = createProjectReward('gantry', assets, material);
    first.position.x = 8;
    expect(second.position.x).toBe(0); expect(first.children[0]).not.toBe(second.children[0]);
    const meshes = (group: THREE.Group): THREE.Mesh[] => { const result: THREE.Mesh[] = []; group.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); }); return result; };
    expect(meshes(first)[0]!.geometry).toBe(meshes(second)[0]!.geometry);
    expect(meshes(first).every(mesh => mesh.material === material)).toBe(true);
    assets.dispose(); material.dispose();
  });
});

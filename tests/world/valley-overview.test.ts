import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ValleyOverview } from '../../src/view/valley-overview';
import { registerWorldKit, WorldAssets } from '../../src/view/world-assets';
import { worldProgress, type WorldProgress } from '../../src/world/progression';

function progress(chapters: number, completed = 0): WorldProgress {
  const levels = Array.from({ length: chapters * 10 }, (_, round) => ['conveyor', 'loop', 'tube'].map(kind => ({ id: `${kind}-${round}`, kind }))).flat();
  return worldProgress(levels, new Set(levels.slice(0, completed).map(level => level.id)));
}

function rig(width: number, height: number) {
  const draw = vi.fn();
  const disposeScene = vi.fn((scene: THREE.Scene) => {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    scene.clear();
  });
  const stage = { canvas: { clientWidth: width, clientHeight: height }, rect: { left: 0, top: 0, width, height },
    renderer: { setSize: vi.fn() }, createScene: () => new THREE.Scene(), draw, disposeScene };
  return { stage, draw, disposeScene };
}

function assets(): WorldAssets {
  registerWorldKit(readFileSync(new URL('../../public/models/world-kit.json', import.meta.url), 'utf8'));
  return new WorldAssets();
}

describe('the 3D valley overview', () => {
  for (const [width, height] of [[375, 690], [1280, 900]] as const) for (const chapters of [1, 6]) {
    it(`keeps ${chapters} village labels separate and reachable in ${width}×${height}`, () => {
      const { stage } = rig(width, height);
      const overview = new ValleyOverview(stage, progress(chapters), assets());
      const checkTargets = (): void => {
        const targets = overview.targets();
        expect(targets).toHaveLength(Math.min(6, chapters));
        for (const target of targets) {
          expect(target.width).toBeGreaterThanOrEqual(44);
          expect(target.x - target.width / 2).toBeGreaterThanOrEqual(12);
          expect(target.x + target.width / 2).toBeLessThanOrEqual(width - 12);
          expect(target.y - 22).toBeGreaterThanOrEqual(130);
          expect(target.y + 22).toBeLessThanOrEqual(height - 76);
          for (const other of targets.filter(other => other.chapter !== target.chapter)) {
            expect(Math.abs(target.x - other.x) >= (target.width + other.width) / 2 || Math.abs(target.y - other.y) >= 44,
              `village ${target.chapter} overlaps village ${other.chapter}`).toBe(true);
          }
        }
      };
      checkTargets();
      while (overview.panRows(1)) checkTargets();
      overview.dispose();
    });
  }

  it('rejects an unauthored chapter instead of recycling an existing miniature', () => {
    const { stage } = rig(375, 690);
    const source = assets();
    try { expect(() => new ValleyOverview(stage, progress(7), source)).toThrow('no authored village plan'); }
    finally { source.dispose(); }
  });

  it('hits the actual 3D village clusters, including locked villages, without adding picking meshes', () => {
    const { stage } = rig(375, 690);
    const overview = new ValleyOverview(stage, progress(6), assets());
    for (let chapter = 0; chapter < 6; chapter++) {
      const cluster = overview.scene.getObjectByName(`valley-village-${chapter}`)!;
      const center = new THREE.Box3().setFromObject(cluster).getCenter(new THREE.Vector3()).project(overview.camera);
      expect(overview.pick((center.x + 1) / 2 * 375, (1 - center.y) / 2 * 690)).toBe(chapter);
    }
    expect(overview.pick(0, 0)).toBeNull();
    overview.dispose();
  });

  it('uses authored 3D village landmarks and stays below 20,000 triangles for the registered valley', () => {
    const { stage, draw } = rig(375, 690);
    const source = assets();
    const model = vi.spyOn(source, 'model');
    const overview = new ValleyOverview(stage, progress(6), source);
    const names = model.mock.calls.map(([name]) => name);
    for (const name of ['boat', 'greenhouse', 'mill', 'clock', 'bridge', 'glassworks']) expect(names).toContain(name);
    let triangles = 0, meshes = 0;
    overview.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
    });
    expect(triangles).toBeGreaterThan(10_000);
    expect(triangles).toBeLessThanOrEqual(20_000);
    expect(meshes).toBeLessThanOrEqual(10);
    expect(draw).not.toHaveBeenCalled();
    overview.update(progress(6, 30), 1);
    overview.resize();
    expect(draw, 'progress and resize request no continuing render loop').not.toHaveBeenCalled();
    overview.draw();
    expect(draw).toHaveBeenCalledOnce();
    overview.dispose();
  });

  it('keeps merged geometry independent of asset disposal and releases each owner once', () => {
    const { stage, disposeScene } = rig(375, 690);
    const source = assets();
    const disposeAssets = vi.spyOn(source, 'dispose');
    const overview = new ValleyOverview(stage, progress(6), source);
    const sceneGeometries: THREE.BufferGeometry[] = [];
    const disposal = vi.fn();
    const materialDisposal = vi.fn();
    overview.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      sceneGeometries.push(object.geometry);
      object.geometry.addEventListener('dispose', disposal);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.addEventListener('dispose', materialDisposal);
    });
    expect(disposal).not.toHaveBeenCalled();
    overview.dispose();
    expect(disposeScene).toHaveBeenCalledOnce();
    expect(disposeAssets).toHaveBeenCalledOnce();
    expect(disposal).toHaveBeenCalledTimes(sceneGeometries.length);
    expect(materialDisposal).toHaveBeenCalledTimes(sceneGeometries.length);
  });
});

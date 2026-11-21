import { Box3, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { WorldKitAssets } from '../../src/view/world-kit';
import { VILLAGE_SCENE_PLANS } from '../../src/world/village-plans';
import { compileTerrain, terrainHeightAt } from '../../src/world/village-terrain';
import { createProjectReward } from '../../src/view/project-rewards';
import { workshopProject } from '../../src/world/workshop-projects';
import { inlandCraft, inlandGeometry } from '../../src/view/inland-craft';
import { NativeRayTree } from './native-ray-tree';
import { surfaceOverlaps, surfaceTriangles } from './surface-overlap';
import { visibleOverlaps } from './village-geometry';

for (const village of VILLAGE_SCENE_PLANS.slice(1)) {
  it(`grounds the new workshops, yards and workers in chapter ${village.chapter}, clear of the machine and neighbours`, () => {
    const kit = new WorldKitAssets(true);
    const material = new MeshBasicMaterial();
    const terrain = compileTerrain(village.cinematicTerrain ?? village.terrain);
    const p = new Vector3();
    const obstacles: {name:string; bounds:Box3}[] = [];
    const route = village.plan.stations.flatMap(s => [s.anchor,s.entry.position,s.exit.position,
      ...(s.supports ?? []), ...('points' in s.mechanism ? s.mechanism.points.map(frame=>frame.position) : [])])
      .concat(village.plan.connectors.flatMap(c=>c.points.map(frame=>frame.position)));
    try {
      const sites = [{...village.workshop.house, model:'house-a'},
        ...village.rewards.map(s=>({...s, model:s.project, scale:1})), ...village.cinematicScenery!];
      for (const site of sites) {
        const reward = workshopProject(site.model)?.reward;
        const model = reward ? createProjectReward(reward,kit,material) : kit.model(site.model,material);
        model.position.fromArray(site.position); model.rotation.y=site.yaw; model.scale.setScalar(site.scale);
        const bounds = new Box3().setFromObject(model);
        const name = site.model+' at '+site.position[0]+', '+site.position[2];
        // Existing doors, tree canopies and installable projects are blockers too.
        const added = village.cinematicScenery!.includes(site) && !village.scenery.includes(site);
        if (added) {
          expect(bounds.isEmpty(),name).toBe(false);
          for(const other of obstacles) expect(bounds.intersectsBox(other.bounds),name+' touches '+other.name).toBe(false);
          const clearance = route.reduce((minimum, position) => Math.min(minimum, bounds.distanceToPoint(p.fromArray(position))), Infinity);
          expect(clearance,name+' meets the route').toBeGreaterThan(.70);
          const local = model.clone(); local.position.set(0,0,0);local.rotation.y=0;local.scale.setScalar(1);
          const localBounds = new Box3().setFromObject(local);
          // Probe the whole footprint including its centre and downhill edge, in the site's own axes.
          for (let ix=0;ix<=6;ix++)for (let iz=0;iz<=6;iz++){
            p.set(localBounds.min.x+(localBounds.max.x-localBounds.min.x)*ix/6, localBounds.min.y,
              localBounds.min.z+(localBounds.max.z-localBounds.min.z)*iz/6).applyMatrix4(model.matrixWorld);
            const soil=terrainHeightAt(terrain,p.x,p.z);
            expect(soil,name+' over open water').toBeDefined();
            expect(p.y-soil!,name+' above its downhill edge').toBeLessThan(.032);
          }
        }
        obstacles.push({name,bounds});
      }
    } finally {kit.dispose(); material.dispose();}
  });
}

const models = Object.keys(inlandCraft) as (keyof typeof inlandCraft)[];

it.each(models)('builds %s without overlapping exposed faces', name => {
  const geometry = inlandGeometry(name);
  const material = new MeshBasicMaterial();
  const model = new Mesh(geometry, material);
  try {
    const faces = surfaceTriangles(model), tree = new NativeRayTree(faces);
    const overlaps = visibleOverlaps(surfaceOverlaps(faces, 1e-5, tree), [tree]);
    expect(overlaps.map(({ a, b, point }) => [a.index, b.index, ...point.toArray()])).toEqual([]);
  } finally { geometry.dispose(); material.dispose(); }
});

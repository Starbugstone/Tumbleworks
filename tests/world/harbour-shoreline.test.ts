import { expect, it } from 'vitest';
import { compileTerrain, terrainHeightAt, terrainOccupancy } from '../../src/world/village-terrain';
import { LITTLE_HARBOUR } from '../../src/world/villages/little-harbour';

it('opens a winding tidal cove with low banks and a headland rising inland', () => {
  const terrain = compileTerrain(LITTLE_HARBOUR.cinematicTerrain ?? LITTLE_HARBOUR.terrain);
  const banks: number[] = [];
  const tips: number[] = [];
  for (const z of [5, 7, 9, 11, 13]) {
    let x = -6;
    while (x < 1 && terrainOccupancy(terrain, x, z) === 'land') x += .125;
    tips.push(x);
    banks.push(terrainHeightAt(terrain, x - .25, z)!);
  }
  expect(Math.max(...tips) - Math.min(...tips)).toBeGreaterThan(1);
  expect(Math.max(...banks)).toBeLessThan(terrain.spec.water);
  expect(terrainHeightAt(terrain, -6, 7)).toBeGreaterThan(2.5);
});

it('keeps the launch hull offshore throughout its trip and returns it to anchor', async () => {
  const { Group, Vector3 } = await import('three');
  const { HarbourLaunch } = await import('../../src/view/harbour-life');
  const boat = new Group(), launch = new HarbourLaunch(boat);
  const terrain = compileTerrain(LITTLE_HARBOUR.cinematicTerrain!);
  const anchor = boat.position.clone();
  let travelled = 0;
  for (let t = 0; t <= 49; t += .125) {
    launch.pose(t);
    boat.updateMatrixWorld();
    travelled = Math.max(travelled, boat.position.distanceTo(anchor));
    // A conservative waterline for the three-metre boat, including its stern.
    for (const x of [-1.5,-.75,0,.75,1.5]) for (const z of [-.65,0,.65]) {
      const p = new Vector3(x,.2,z).applyMatrix4(boat.matrixWorld);
      expect(terrainHeightAt(terrain,p.x,p.z) ?? -Infinity).toBeLessThan(p.y);
    }
  }
  expect(travelled).toBeGreaterThan(8);
  expect(launch.wake.w).toBe(0);
  expect(boat.position.x).toBeCloseTo(anchor.x);
  expect(boat.position.z).toBeCloseTo(anchor.z);
});

it('grounds every Little Harbour building, doorstep and tree across its rendered footprint', async () => {
  const { Mesh, MeshBasicMaterial, Raycaster, Vector3 } = await import('three');
  const { WorldKitAssets } = await import('../../src/view/world-kit');
  const { createVillageTerrain } = await import('../../src/view/village-terrain');
  const kit = new WorldKitAssets(true,true), material = new MeshBasicMaterial();
  const { createProjectReward } = await import('../../src/view/project-rewards');
  const { workshopProject } = await import('../../src/world/workshop-projects');
  const ground = createVillageTerrain(LITTLE_HARBOUR.cinematicTerrain!,material,'full',true);
  const ray = new Raycaster(), pos = new Vector3(), down = new Vector3(0,-1,0);
  try {
    const sites = [...LITTLE_HARBOUR.scenery,{ ...LITTLE_HARBOUR.workshop.house, model:'house-a' },
      ...LITTLE_HARBOUR.rewards.map(slot => ({...slot, model:slot.project, scale:1}))];
    for (const site of sites) {
      if (site.model === 'boat') continue;
      const reward = workshopProject(site.model)?.reward;
      const building=reward ? createProjectReward(reward,kit,material) : kit.model(site.model,material);
      let probes = 0;
      building.position.fromArray(site.position);building.rotation.y=site.yaw;building.scale.setScalar(site.scale);
      building.updateMatrixWorld();
      building.traverse(m => {
        if (!(m instanceof Mesh)) return;
        const verts=m.geometry.getAttribute('position');

        for (let i=0;i<verts.count;i++) {
          pos.fromBufferAttribute(verts,i).applyMatrix4(m.matrixWorld);
          if (pos.y>site.position[1]+.14) continue;
          probes++;
          ray.set(new Vector3(pos.x,site.position[1]+1,pos.z),down);
          const height=ray.intersectObject(ground)[0]?.point.y ?? -Infinity;
          expect(height,`${site.model} at ${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}`).toBeGreaterThanOrEqual(site.position[1]-.035);
          expect(height).toBeLessThanOrEqual(site.position[1]+.10);
        }
      });
      expect(probes).toBeGreaterThan(0);
    }
  } finally {ground.geometry.dispose();kit.dispose();material.dispose();}
});

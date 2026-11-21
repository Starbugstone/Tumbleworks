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
  const { Box3, Mesh, MeshBasicMaterial, Group, Vector3 } = await import('three');
  const { HarbourLaunch } = await import('../../src/view/harbour-life');
  const { harbourScenery, harbourSkiff } = await import('../../src/view/harbour-craft');
  const dinghy = LITTLE_HARBOUR.cinematicScenery!.find(site => site.model==='harbour-dinghy')!;
  const dinghyGeometry = harbourScenery(dinghy.model)!, skiffGeometry = harbourSkiff(), material = new MeshBasicMaterial();
  const boat = new Group(), moored = new Mesh(dinghyGeometry, material), boatMesh = new Mesh(skiffGeometry, material);
  boat.add(boatMesh);
  const launch = new HarbourLaunch(boat);
  moored.position.fromArray(dinghy.position); moored.scale.setScalar(dinghy.scale); moored.rotation.y=dinghy.yaw;
  const mooredBounds = new Box3().setFromObject(moored), passingBounds = new Box3();
  const terrain = compileTerrain(LITTLE_HARBOUR.cinematicTerrain!);
  const anchor = boat.position.clone();
  let travelled = 0;
  try {
    for (const x of [mooredBounds.min.x,moored.position.x,mooredBounds.max.x]) for (const z of [mooredBounds.min.z,moored.position.z,mooredBounds.max.z]) {
      expect(terrainHeightAt(terrain,x,z) ?? -Infinity).toBeLessThan(terrain.spec.water);
    }
    for (let t = 0; t <= 49; t += .125) {
      launch.pose(t);
      boat.updateMatrixWorld();
      travelled = Math.max(travelled, boat.position.distanceTo(anchor));
      expect(passingBounds.setFromObject(boatMesh).intersectsBox(mooredBounds), `launch at ${t}s`).toBe(false);
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
  } finally { dinghyGeometry.dispose(); skiffGeometry.dispose(); material.dispose(); }
});

it('grounds every Little Harbour building, doorstep and tree across its rendered footprint', async () => {
  const { Mesh, MeshBasicMaterial, Ray, Vector3 } = await import('three');
  const { WorldKitAssets } = await import('../../src/view/world-kit');
  const { createVillageTerrain } = await import('../../src/view/village-terrain');
  const kit = new WorldKitAssets(true,true), material = new MeshBasicMaterial();
  const { createProjectReward } = await import('../../src/view/project-rewards');
  const { workshopProject } = await import('../../src/world/workshop-projects');
  const ground = createVillageTerrain(LITTLE_HARBOUR.cinematicTerrain!,material,'full',true);
  const { footprintIndex } = await import('./footprint-index');
  const { surfaceTriangles } = await import('./surface-overlap');
  const { footprintAudit } = await import('./captive-terrain-footprint');
  const groundFaces = footprintIndex(surfaceTriangles(ground, 0));
  const terrain = compileTerrain(LITTLE_HARBOUR.cinematicTerrain!);
  const townHouses = new Set(['fisher-row','pilot-house','salt-cottage','smokehouse','chandlery']);
  const ray = new Ray(new Vector3(), new Vector3(0,-1,0)), pos = new Vector3(), hit = new Vector3();
  try {
    const sites = [...(LITTLE_HARBOUR.cinematicScenery ?? LITTLE_HARBOUR.scenery),{ ...LITTLE_HARBOUR.workshop.house, model:'house-a' },
      ...LITTLE_HARBOUR.rewards.map(slot => ({...slot, model:slot.project, scale:1}))];
    for (const site of sites) {
      if (site.model === 'boat' || site.model === 'harbour-dinghy') continue;
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
          ray.origin.set(pos.x,site.position[1]+1,pos.z);
          let height = -Infinity;
          for (const face of groundFaces(ray.origin)) {
            if (ray.intersectTriangle(face.a, face.b, face.c, true, hit)) height = Math.max(height, hit.y);
          }
          expect(height,`${site.model} at ${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}`).toBeGreaterThanOrEqual(site.position[1]-.035);
          expect(height,`${site.model} at ${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}`).toBeLessThanOrEqual(site.position[1]+.10);
        }
      });
      expect(probes).toBeGreaterThan(0);
      if (townHouses.has(site.model)) {
        const anchor = [...site.position];
        const faces = surfaceTriangles(building);
        // Terrain must cross the full depth of both the main foundation and the shallower doorstep.
        for (const [name, top, depth] of [['foundation',.16,.36],['step',.13,.26]] as const) {
          const cap = faces.filter(face => face.normal.y > .99 && Math.abs(face.a.y - anchor[1]! - top * site.scale) < 1e-6);
          const audit = (rise: number) => {
            const bottom = cap.map(({a,b,c}) => [a.clone(),b.clone(),c.clone()] as [typeof a,typeof a,typeof a]);
            for (const triangle of bottom) for (const vertex of triangle) vertex.y += rise;
            return footprintAudit([{name,centre:anchor,ground:anchor[1]!,bottom}],terrain)[0]!;
          };
          const report = audit(0), message = `${site.model} ${name} at ${anchor.join(', ')}`;
          expect(report.samples, message).toBeGreaterThan(0);
          expect(report.covered, message).toBeCloseTo(report.expected, 8);
          expect(report.minimum, message).toBeGreaterThan(.015);
          expect(report.maximum, message).toBeLessThan(depth * site.scale - .02);
          if (site.model === 'smokehouse') expect(audit(.42).maximum, message).toBeGreaterThan(depth * site.scale);
        }
      }
    }
  } finally {ground.geometry.dispose();kit.dispose();material.dispose();}
});

it('keeps the slipway counterweight and gantry clear of tree canopies through the final bends', async () => {
  const { Box2, Box3, MeshBasicMaterial, Vector2, Vector3 } = await import('three');
  const { cinematicWorld } = await import('./cinematic-world-fixture');
  const { WorldKitAssets } = await import('../../src/view/world-kit');
  const fixture = cinematicWorld(0,true);
  const kit = new WorldKitAssets(true,true), material = new MeshBasicMaterial();
  try {
    const crown = (site: typeof LITTLE_HARBOUR.scenery[number]) => {
      const tree = kit.model(site.model, material);
      const local = new Box3().setFromObject(tree);
      local.min.y += (local.max.y - local.min.y) * .45;
      tree.position.fromArray(site.position); tree.scale.setScalar(site.scale); tree.rotation.y = site.yaw;
      tree.updateMatrixWorld();
      return local.applyMatrix4(tree.matrixWorld);
    };
    const point = new Vector3();
    const project = (box: InstanceType<typeof Box3>) => {
      const screen = new Box2();
      for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
        point.set(x,y,z).project(fixture.world.camera);
        screen.expandByPoint(new Vector2(point.x,point.y));
      }
      return screen;
    };
    const crowns = LITTLE_HARBOUR.cinematicScenery!.filter(site => site.model === 'coastal-thicket').map(crown);
    expect(crowns.length).toBeGreaterThan(0);
    const oldTree = LITTLE_HARBOUR.scenery.find(site => site.model === 'tree-a' && site.position[0] === 6)!;
    const oldCrown = crown(oldTree);
    const mast = fixture.world.scene.getObjectByName('village-source-mast-2')!;
    const weight = fixture.world.scene.getObjectByName('village-2-weight')!;
    let historicalObstructions = 0;
    for (let frame = 11 * 24; frame <= 15.5 * 24; frame += 3) {
      fixture.world.film(frame/24);
      fixture.world.scene.updateMatrixWorld();
      const opening = project(new Box3().setFromObject(mast)).union(project(new Box3().setFromObject(weight)));
      if (opening.intersectsBox(project(oldCrown))) historicalObstructions++;
      expect(crowns.some(box => opening.intersectsBox(project(box))), 'foliage at '+frame/24+' s').toBe(false);
    }
    expect(historicalObstructions).toBeGreaterThan(0);
  } finally {
    fixture.dispose(); kit.dispose(); material.dispose();
  }
});

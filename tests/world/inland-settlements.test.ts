import { Box2, Box3, Group, Mesh, MeshBasicMaterial, Ray, Triangle, Vector2, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { WorldKitAssets } from '../../src/view/world-kit';
import { VILLAGE_SCENE_PLANS, type VillageSceneryPiece } from '../../src/world/village-plans';
import { compileTerrain, terrainHeightAt } from '../../src/world/village-terrain';
import { createProjectReward } from '../../src/view/project-rewards';
import { workshopProject } from '../../src/world/workshop-projects';
import { inlandCraft, inlandGeometry } from '../../src/view/inland-craft';
import { NativeRayTree } from './native-ray-tree';
import { surfaceOverlaps, surfaceTriangles } from './surface-overlap';
import { indexedTrackCrossings, visible, visibleOverlaps } from './village-geometry';
import { cinematicWorld } from './cinematic-world-fixture';
import { ARTISAN_SURFACE, markVillageArtisan, villageArtisans } from '../../src/view/village-artisan';
import { bakeWorldGroup } from '../../src/view/world-bake';
import { TERRAIN_SURFACE } from '../../src/view/village-terrain';
import { inlandDistricts } from '../../src/world/villages/inland-districts';

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

it('bakes shared worker geometry into one draw with two distinct arm pivots', () => {
  const geometry = inlandGeometry('glassworker'), material = new MeshBasicMaterial(), landscape = new Group();
  const sites = [
    {model:'glassworker',position:[-2,0,1],scale:1,yaw:0},
    {model:'glassworker',position:[4,0,1],scale:1,yaw:Math.PI/2},
  ] as const;
  for (const [index,site] of sites.entries()) {
    const mesh = new Mesh(geometry,material);
    mesh.position.fromArray(site.position); mesh.rotation.y = site.yaw;
    markVillageArtisan(mesh,index); landscape.add(mesh);
  }
  const baked = bakeWorldGroup(landscape,material)!;
  try {
    const tags = baked.geometry.getAttribute('terrainSurface'), original = geometry.getAttribute('terrainSurface');
    const shoulderFaces = [...original.array].filter(tag=>tag===ARTISAN_SURFACE).length;
    expect(shoulderFaces).toBeGreaterThan(0);
    expect(landscape.children).toEqual([baked]);
    expect([...tags.array].filter(tag=>tag===ARTISAN_SURFACE)).toHaveLength(shoulderFaces);
    expect([...tags.array].filter(tag=>tag===ARTISAN_SURFACE+1)).toHaveLength(shoulderFaces);
    expect([...original.array].includes(ARTISAN_SURFACE+1)).toBe(false);
    const pose = villageArtisans(material, sites);
    type Shader = Parameters<typeof material.onBeforeCompile>[0];
    const shader = {uniforms:{},vertexShader:'#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>'} as Shader;
    material.onBeforeCompile(shader,{} as Parameters<typeof material.onBeforeCompile>[1]);
    expect(shader.vertexShader.match(/uniform float uWorkBeat/g)).toHaveLength(1);
    expect(shader.uniforms.uShoulders!.value.map((v:Vector3)=>v.x)).toEqual([-1.822,4.016]);
    expect(shader.uniforms.uWorkAxes!.value.map((v:Vector3)=>v.z)).toEqual([-0,-1]);
    pose(1,false);
    expect(shader.uniforms.uWorkBeat!.value).toBeGreaterThan(0);
    pose(1,true);
    expect(shader.uniforms.uWorkBeat!.value).toBe(0);
  } finally { baked.geometry.dispose(); geometry.dispose(); material.dispose(); }
});

it.each([3,5])('keeps chapter %i landmarks outside the stop faces in the built phone map', chapter => {
  const { world, dispose } = cinematicWorld(chapter);
  const plan = VILLAGE_SCENE_PLANS[chapter]!;
  const terrain = compileTerrain(plan.cinematicTerrain ?? plan.terrain);
  const kit = new WorldKitAssets(true), material = new MeshBasicMaterial();
  const vertex = new Vector3(), projected = new Vector2(), outline = new Box2();
  // Built faces are 18 px across. Leave three more pixels for the rim and its shadow.
  const clearance = 12;
  try {
    world.resetView();
    const pins = world.targets().map(({ x, y }) => new Vector2(x, y));
    const pinGapAt = (site: VillageSceneryPiece, x: number, z: number): number => {
      const group = kit.model(site.model, material);
      group.position.set(x,terrainHeightAt(terrain,x,z)!,z);
      group.rotation.y = site.yaw; group.scale.setScalar(site.scale); group.updateMatrixWorld();
      outline.makeEmpty();
      group.traverse(object => {
        if (!(object instanceof Mesh)) return;
        const positions = object.geometry.getAttribute('position');
        for (let i=0;i<positions.count;i++) {
          vertex.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld).project(world.camera);
          outline.expandByPoint(projected.set((vertex.x+1)*375/2,(1-vertex.y)*690/2));
        }
      });
      expect(outline.isEmpty()).toBe(false);
      return Math.min(...pins.map(pin => outline.distanceToPoint(pin)));
    };
    const landmarks = plan.cinematicScenery!.filter(({ model, position }) => chapter === 3 ? model === 'civic-clock' :
      model === 'glass-packing-house' || ((model === 'bottle-kiln' || model === 'annealing-shed') && position[2] < -9));
    expect(landmarks).toHaveLength(chapter === 3 ? 1 : 8);
    for (const site of landmarks) {
      expect(pinGapAt(site,site.position[0],site.position[2]),site.model).toBeGreaterThan(clearance);
      if (site.model === 'civic-clock') expect(pinGapAt(site,9.3,-10.3)).toBeLessThan(clearance);
      if (site.model === 'bottle-kiln' && site.scale === 1.11) expect(pinGapAt(site,7.75,-11.9)).toBeLessThan(clearance);
      if (site.model === 'annealing-shed') expect(pinGapAt(site,10.45,-12.15)).toBeLessThan(clearance);
      if (site.model === 'glass-packing-house' && site.scale === .86) expect(pinGapAt(site,8.7,7.5)).toBeLessThan(clearance);
    }
  } finally { kit.dispose(); material.dispose(); dispose(); }
},30000);

it.each([4,5])('keeps the chapter %i terrace fixtures clear of the full machine and support triangles', chapter => {
  const { machine, dispose } = cinematicWorld(chapter);
  const kit = new WorldKitAssets(true), material = new MeshBasicMaterial();
  const groups = chapter === 4 ? [
    ['fell-cottage',1.11,11.23,12.64], ['sheepfold',1.02,4.01,6.33],
  ] as const : [
    ['glassworker',1.03,5,11.36], ['glass-sorting-yard',1.06,8.49,-4.24],
  ] as const;
  try {
    const scene = VILLAGE_SCENE_PLANS[chapter]!;
    const terrain = compileTerrain(scene.cinematicTerrain ?? scene.terrain);
    const shipped = new Group(), previous = new Group();
    for (const [name,scale,x,z] of groups) {
      const site = scene.cinematicScenery!.find(model => model.model===name && model.scale===scale)!;
      const group = kit.model(name, material);
      group.traverse(object => { object.name = name; });
      group.position.fromArray(site.position); group.scale.setScalar(scale); group.rotation.y=site.yaw;
      const old = group.clone(); old.position.set(x,terrainHeightAt(terrain,x,z)!,z);
      shipped.add(group); previous.add(old);
    }
    const current = new NativeRayTree(surfaceTriangles(shipped));
    const machineFaces = () => surfaceTriangles(machine.root).filter(face=>visible(face.mesh));
    machine.apply(0);
    for (const old of previous.children) {
      expect(indexedTrackCrossings(machineFaces(),[new NativeRayTree(surfaceTriangles(old))]),old.name).not.toHaveLength(0);
    }
    const times = new Set(machine.route.contacts.flatMap(c=>[c.start,(c.start+c.end)/2,c.end]));
    for (let i=0;i<=24;i++) times.add(machine.route.duration*i/24);
    for (const seconds of times) {
      machine.apply(seconds);
      expect(indexedTrackCrossings(machineFaces(),[current]),`complete assembly at ${seconds}s`).toEqual([]);
    }
  } finally { kit.dispose(); material.dispose(); dispose(); }
},30000);

it.each([3,4,5])('composes at least three quarters of the usable land in chapter %i phone map and film views', chapter => {
  const { world, machine, dispose } = cinematicWorld(chapter);
  try {
    const landscape = world.scene.getObjectByName(`village-landscape-${chapter}`)!;
    const tree = new NativeRayTree(surfaceTriangles(landscape));
    const ray = new Ray(), cursor = new Vector3(), triangle = new Triangle(), barycentric = new Vector3();
    const districts = inlandDistricts[chapter]!;
    world.resetView();
    const moments = [null, ...[.12,.43,.8].map(fraction => fraction * machine.route.duration)];
    for (const seconds of moments) {
      if (seconds !== null) world.film(seconds);
      let architecture = 0, usedGround = 0, bareGround = 0;
      // At each sample use the foremost baked landscape triangle, independent of badges and the machine.
      for (let y=2;y<690;y+=4) for (let x=2;x<375;x+=4) {
        cursor.set(x*2/375-1,1-y*2/690,.5).unproject(world.camera);
        ray.set(world.camera.position,cursor.sub(world.camera.position).normalize());
        const nearest = tree.hits(ray,world.camera.far)
          .filter(hit => hit.face.normal.dot(ray.direction) < 0).sort((a,b) => a.distance-b.distance)[0];
        if (!nearest) continue;
        const { face, point } = nearest, attributes = face.mesh.geometry.attributes, i = face.index*3;
        const surface = attributes.terrainSurface!.getX(i);
        if (surface === 0) { architecture++; continue; }
        if (surface >= TERRAIN_SURFACE.bank || (chapter === 4 && surface === TERRAIN_SURFACE.plot)) continue;
        triangle.set(face.a,face.b,face.c).getBarycoord(point,barycentric);
        const grade = attributes.grade!;
        if (barycentric.x*grade.getX(i)+barycentric.y*grade.getX(i+1)+barycentric.z*grade.getX(i+2) >= .98) continue;
        const marked = districts.some(([,cx,cz,w,d]) => {
          const dx = Math.abs(point.x-cx)-w, dz = Math.abs(point.z-cz)-d;
          return Math.max(dx,dz,(dx+dz+.60)*.7071) < .04;
        });
        if (marked) usedGround++; else bareGround++;
      }
      expect(architecture).toBeGreaterThan(0);
      const total = architecture+usedGround+bareGround;
      expect(bareGround/total,seconds===null?'built map':`film at ${seconds.toFixed(2)}s`).toBeLessThan(.25);
    }
  } finally { dispose(); }
},30000);

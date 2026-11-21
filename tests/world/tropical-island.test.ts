import { Box3, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { compileTerrain, distanceToPolygon, pointInPolygon, terrainHeightAt, terrainOccupancy } from '../../src/world/village-terrain';
import { villageScenePlan } from '../../src/world/village-plans';
import { createVillageTerrain } from '../../src/view/village-terrain';
import { BANK_HIGHEST, coastalEdges, coastSample, riverBanks, tropicalCoast } from '../../src/view/tropical-island';

it('opens the harbour water to the continuous sea without moving any land', () => {
  const terrain = compileTerrain(villageScenePlan(0).terrain), material = new MeshBasicMaterial();
  const mesh = createVillageTerrain(terrain, material, 'full', true);
  const ray = new Raycaster(new Vector3(0, 30, 10), new Vector3(0, -1, 0));
  mesh.updateMatrixWorld(true);
  expect(ray.intersectObject(mesh)).toHaveLength(0);
  ray.ray.origin.set(-7, 30, 0);
  expect(ray.intersectObject(mesh)[0]!.point.y).toBeCloseTo(terrainHeightAt(terrain, -7, 0)!, 5);
  mesh.geometry.dispose(); material.dispose();
});

it('rounds the fountain basin shoulder without filling the open irrigation water', async () => {
  const { cinematicWorld } = await import('./cinematic-world-fixture');
  const f = cinematicWorld(1);
  try {
    const terrain = compileTerrain(villageScenePlan(1).terrain);
    const landscape = f.world.scene.getObjectByName('village-landscape-1');
    const mesh = landscape?.children.find(node => node instanceof Mesh);
    if (!(mesh instanceof Mesh)) throw new Error('Missing Garden terrain');
    mesh.updateWorldMatrix(true, false);
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
    const height = (x: number, z: number) => {
      ray.ray.origin.set(x, 4, z);
      return ray.intersectObject(mesh)[0]?.point.y ?? -Infinity;
    };
    // This is the outside corner of the raised fountain platform in the film close-up.
    expect(terrainOccupancy(terrain, 7.6744, 2.8171)).toBe('water');
    expect(height(7.6744, 2.8171)).toBeGreaterThan(terrain.spec.water + .002);
    expect(height(6.4, 7.4)).toBeLessThan(terrain.spec.water);
  } finally { f.dispose(); }
});

it('rounds the Willow bank toe in the film without damming its surveyed river', async () => {
  const { cinematicWorld } = await import('./cinematic-world-fixture');
  const f = cinematicWorld(2);
  try {
    const { water } = villageScenePlan(2).terrain;
    const ground = f.world.scene.getObjectByName('village-landscape-2')?.children.find(node => node instanceof Mesh);
    if (!(ground instanceof Mesh)) throw new Error('Missing Willow terrain');
    ground.updateWorldMatrix(true, false);
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
    const surface = (x: number, z: number) => {
      ray.ray.origin.set(x, 12, z);
      return ray.intersectObject(ground)[0]?.point.y ?? -Infinity;
    };
    // The square exposed face in the film was the native cell edge at z=3.
    for (const x of [-2.96, -2.82, -2.62]) {
      expect(surface(x, 2.99)).toBeGreaterThan(water);
      expect(surface(x, 2.99)).toBeLessThan(water + .20);
    }
    for (let i = 0; i <= 13; i++) {
      const z = 3.3 + i / 10;
      // The surveyed centre runs from (1.3,-.5) to (-2.5,5) here.
      const centre = 1.3 - (z + .5) * 3.8 / 5.5;
      expect(surface(centre, z)).toBeLessThanOrEqual(water);
      expect(surface(centre - 2.3, z)).toBeGreaterThan(water);
    }
  } finally { f.dispose(); }
}, 30_000);

it('keeps the Willow mill clear of the whole aqueduct, including its feet', async () => {
  const { cinematicWorld } = await import('./cinematic-world-fixture');
  const { WorldKitAssets } = await import('../../src/view/world-kit');
  const { surfaceTriangles } = await import('./surface-overlap');
  const { trackCrossings } = await import('./village-geometry');
  const f = cinematicWorld(2, true), kit = new WorldKitAssets(true), material = new MeshBasicMaterial();
  try {
    const site = villageScenePlan(2).cinematicScenery?.find(piece => piece.model === 'mill');
    if (!site) throw new Error('Missing surveyed mill');
    const model = kit.model(site.model, material);
    model.position.fromArray(site.position); model.rotation.y = site.yaw; model.scale.setScalar(site.scale);
    f.machine.apply(2.75);
    const machine = surfaceTriangles(f.machine.root);
    expect(trackCrossings(machine, surfaceTriangles(model))).toEqual([]);
    // This larger downstream shift leaves the rail clear but intersects its trestle.
    model.position.z = .77;
    expect(trackCrossings(machine, surfaceTriangles(model)).map(hit => hit.track)).toContain('village-stop-4-static-BoxGeometry-0');
  } finally { f.dispose(); material.dispose(); kit.dispose(); }
}, 30_000);

it.each([0, 1, 2, 3, 4, 5])('keeps chapter %i coastal triangles outside authored land and protected structures', chapter => {
  const terrain = compileTerrain(villageScenePlan(chapter).terrain);
  const forbidden = new Box3(new Vector3(-30, -10, -30), new Vector3(-8, 40, 30));
  const coast = tropicalCoast(terrain, [forbidden]);
  const p = coast.getAttribute('position');
  expect(p.count).toBeGreaterThan(0);
  for (let i = 0; i < (coast.index?.count ?? p.count); i += 3) {
    const center = new Vector3();
    for (let j = 0; j < 3; j++) center.add(new Vector3().fromBufferAttribute(p, coast.index?.getX(i+j) ?? i+j));
    center.divideScalar(3);
    expect(terrainHeightAt(terrain, center.x, center.z)).toBeUndefined();
    expect(forbidden.containsPoint(center)).toBe(false);
  }
  coast.dispose();
});

it('preserves every native terrain attribute when static island dressing joins its draw', async () => {
  const THREE=await import('three');
  const {bakeWorldGroup,appendWorldGeometry}=await import('../../src/view/world-bake');
  const {bindNativeTerrain,nativeTerrainOwnership}=await import('../../src/view/village-terrain');
  const terrain=compileTerrain(villageScenePlan(0).terrain),material=new MeshBasicMaterial();
  const ground=createVillageTerrain(terrain,material,'full',true),group=new THREE.Group();group.add(ground);
  const baked=bakeWorldGroup(group,material)!;bindNativeTerrain(ground.geometry,baked);
  const before=Float32Array.from(baked.geometry.getAttribute('position').array),identity=baked.geometry;
  const coast=tropicalCoast(terrain,[]);appendWorldGeometry(baked,[coast]);
  expect(baked.geometry).toBe(identity);expect(nativeTerrainOwnership(baked).terrain).toBe(terrain);
  expect(baked.geometry.getAttribute('position').array.slice(0,before.length)).toEqual(before);
  expect(baked.geometry.getAttribute('position').count).toBeGreaterThan(before.length/3);
  ground.geometry.dispose();coast.dispose();baked.geometry.dispose();material.dispose();
});

it.each([0,1,2,3,4,5])('stitches every coarse beach edge in chapter %i to its fine neighbours',chapter=>{
  const g=tropicalCoast(compileTerrain(villageScenePlan(chapter).terrain),[]),p=g.getAttribute('position'),ix=g.index!;
  const rows=new Map<number,Vector3[]>(),columns=new Map<number,Vector3[]>();
  for(let i=0;i<p.count;i++){
    const v=new Vector3().fromBufferAttribute(p,i);
    if(!rows.has(v.z))rows.set(v.z,[]);rows.get(v.z)!.push(v);
    if(!columns.has(v.x))columns.set(v.x,[]);columns.get(v.x)!.push(v);
  }
  for(let i=0;i<ix.count;i+=3)for(let j=0;j<3;j++){
    const a=new Vector3().fromBufferAttribute(p,ix.getX(i+j)),b=new Vector3().fromBufferAttribute(p,ix.getX(i+(j+1)%3));
    const axis=a.z===b.z?'x':a.x===b.x?'z':null;if(!axis)continue;
    const line=axis==='x'?rows.get(a.z)!:columns.get(a.x)!;
    for(const v of line){const u=(v[axis]-a[axis])/(b[axis]-a[axis]);if(u>1e-5&&u<1-1e-5)expect(v.y,`open beach edge ${a.toArray()} -> ${b.toArray()} at ${v.toArray()}`).toBeCloseTo(a.y+(b.y-a.y)*u,4);}
  }
  g.dispose();
});

it.each([0,1,2,3,4,5])('keeps chapter %i coastal additions clear of the full moving track width',async chapter=>{
  const {cinematicWorld}=await import('./cinematic-world-fixture');
  const {surfaceTriangles}=await import('./surface-overlap');
  const {trackCrossings}=await import('./village-geometry');
  const f=cinematicWorld(chapter,true);
  try{
    const all=surfaceTriangles(f.world.scene),land=all.find(s=>s.mesh.geometry.userData['coastalDressing'])!.mesh;
    const first=land.geometry.userData['coastalDressing'].first/3;
    const dressing=all.filter(s=>s.mesh===land&&s.index>=first);
    expect(dressing.length).toBeGreaterThan(100);
    const route=f.machine.route;
    const times=new Set([0,route.duration,...route.transfers.filter(t=>t.kind==='carry').flatMap(t=>[t.start,(t.start+t.end)/2,t.end])]);
    for(const time of times){
      f.machine.apply(time);
      const tracks=surfaceTriangles(f.machine.root);
      expect(trackCrossings(tracks,dressing),`coastal collision at ${time}`).toEqual([]);
    }
  }finally{f.dispose();}
},60_000);

it.each([0,1,2,3,4,5])('keeps chapter %i new shore faces separate from exposed land faces',async chapter=>{
  const {cinematicWorld}=await import('./cinematic-world-fixture');
  const {surfaceTriangles,surfaceOverlaps}=await import('./surface-overlap');
  const f=cinematicWorld(chapter);
  try{
    const all=surfaceTriangles(f.world.scene),land=all.find(s=>s.mesh.geometry.userData['coastalDressing'])!.mesh;
    const first=land.geometry.userData['coastalDressing'].first/3;
    const dressing=all.filter(s=>s.mesh===land&&s.index>=first),newFaces=new Set(dressing);
    const foreign=all.filter(s=>s.mesh!==land&&s.mesh.name!=='village-sea'&&dressing.some(d=>d.bounds.intersectsBox(s.bounds)));
    const {trackCrossings}=await import('./village-geometry');
    expect(trackCrossings(dressing,foreign),'new scenery against earned buildings and the full machine').toEqual([]);
    const overlaps=surfaceOverlaps([...all.filter(s=>s.mesh===land),...foreign]).filter(overlap=>newFaces.has(overlap.a)||newFaces.has(overlap.b));
    expect(overlaps.map(o=>({a:o.a.index,b:o.b.index,area:o.area}))).toEqual([]);
  }finally{f.dispose();}
},30_000);

/** An open beach edge is visible unless the land's cliff closes it or the opaque sea covers it. */
function exposedBeachEdges(chapter:number,protectedBounds:readonly Box3[]){
  const terrain=compileTerrain(villageScenePlan(chapter).terrain),edges=coastalEdges(terrain),g=tropicalCoast(terrain,protectedBounds);
  const p=g.getAttribute('position'),ix=g.index!,count=new Map<string,number>(),key=(a:number,b:number)=>a<b?`${a}/${b}`:`${b}/${a}`;
  for(let i=0;i<ix.count;i+=3)for(let j=0;j<3;j++){const k=key(ix.getX(i+j),ix.getX(i+(j+1)%3));count.set(k,(count.get(k)??0)+1);}
  const onLand=(i:number)=>coastSample(edges,terrain.spec.water,p.getX(i),p.getZ(i)).distance<1e-5,wet=(i:number)=>p.getY(i)<=terrain.spec.water;
  const exposed:number[][]=[];
  for(const [k,n] of count){if(n!==1)continue;const [a,b]=k.split('/').map(Number) as [number,number];if((onLand(a)&&onLand(b))||(wet(a)&&wet(b)))continue;exposed.push([a,b].flatMap(i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>+v.toFixed(2))));}
  g.dispose();return exposed;
}
it.each([0,1,2,3,4,5])('never leaves a chapter %i beach edge hanging above the water beside an inlet',chapter=>{
  expect(exposedBeachEdges(chapter,[])).toEqual([]);
});
it('dips the beach under the water around coastal structures instead of cutting a ledge',()=>{
  // Little Harbour's corner house overhangs the shore; a support beside it stands in the sea.
  const house=new Box3(new Vector3(-10.2,3.1,10.4),new Vector3(-5.8,8,14.6)),post=new Box3(new Vector3(-3.4,-2,-14.8),new Vector3(-1.8,6,-13.6));
  expect(exposedBeachEdges(0,[house,post])).toEqual([]);
  const terrain=compileTerrain(villageScenePlan(0).terrain),g=tropicalCoast(terrain,[house,post]),p=g.getAttribute('position'),ix=g.index!;
  for(let i=0;i<ix.count;i+=3){
    const tri=new Box3();for(let j=0;j<3;j++)tri.expandByPoint(new Vector3().fromBufferAttribute(p,ix.getX(i+j)));
    for(const bound of [house,post])expect(tri.intersectsBox(bound),`beach triangle ${tri.min.toArray()} enters a structure`).toBe(false);
  }
  g.dispose();
});

// Glasshouse Gardens (chapter 1) is drawn on 1.33 x 2.29 m cells: a notch's outer corner lies a metre beyond
// its steps and the beach slopes from it by design. Fine grids must fill their notches.
it.each([0,2,3,4,5])('fills every chapter %i coastal stair notch flush with the bank, so a diagonal coast reads as a line',chapter=>{
  const terrain=compileTerrain(villageScenePlan(chapter).terrain);
  expect(Math.max(terrain.cellWidth,terrain.cellDepth)).toBeLessThan(.6);
  const mesh=new Mesh(tropicalCoast(terrain,[]),new MeshBasicMaterial()),ray=new Raycaster();
  const kind=(c:number,r:number)=>c<0||r<0||c>=terrain.columns||r>=terrain.rows?'void':terrain.cells[r*terrain.columns+c];
  const sunk:number[][]=[];let notches=0;
  for(let r=0;r<terrain.rows;r++)for(let c=0;c<terrain.columns;c++){
    if(kind(c,r)!=='void')continue;
    // An inside corner of the staircase: land on one side in each direction.
    const across=[kind(c-1,r),kind(c+1,r)].includes('land'),along=[kind(c,r-1),kind(c,r+1)].includes('land');
    if(!across||!along)continue;
    const x=terrain.originX+(c+.5)*terrain.cellWidth,z=terrain.originZ+(r+.5)*terrain.cellDepth;
    ray.set(new Vector3(x,50,z),new Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];if(!hit)continue;
    notches++;
    const bank=Math.min(...[[c,r],[c+1,r],[c,r+1],[c+1,r+1]].filter(([vc,vr])=>[kind(vc!-1,vr!-1),kind(vc!,vr!-1),kind(vc!-1,vr!),kind(vc!,vr!)].includes('land')).map(([vc,vr])=>terrain.heights[vr!*(terrain.columns+1)+vc!]!));
    if(hit.point.y<bank-.08)sunk.push([x,z,hit.point.y,bank].map(v=>+v.toFixed(2)));
  }
  if(chapter===0)expect(notches).toBeGreaterThan(10);
  expect(sunk).toEqual([]);
  mesh.geometry.dispose();
});

it('keeps the Little Harbour shore level with the lawn beside its corner house',async()=>{
  const {cinematicWorld}=await import('./cinematic-world-fixture');
  const f=cinematicWorld(0);
  try{
    const land=surfaceMesh(f.world.scene),ray=new Raycaster(new Vector3(-7.25,50,14.6),new Vector3(0,-1,0));
    // The house stands on the bank; padding its clearance downwards sank the beach and bared the stepped cliff.
    expect(ray.intersectObject(land)[0]!.point.y).toBeGreaterThan(terrainHeightAt(compileTerrain(villageScenePlan(0).terrain),-7.25,14.4)!-.15);
  }finally{f.dispose();}
},30_000);
function surfaceMesh(scene:import('three').Object3D):Mesh{let found:Mesh|undefined;scene.traverse(o=>{if(o instanceof Mesh&&o.geometry.userData['coastalDressing'])found=o;});return found!;}

describe('Willow Mill river banks',()=>{
  const terrain=compileTerrain(villageScenePlan(2).terrain),river=villageScenePlan(2).terrain.features.find(f=>f.kind==='hole')!.polygon;
  const kind=(c:number,r:number)=>c<0||r<0||c>=terrain.columns||r>=terrain.rows?'void':terrain.cells[r*terrain.columns+c];
  const touchesLand=(x:number,z:number)=>[[1,1],[1,-1],[-1,1],[-1,-1]].some(([dx,dz])=>terrainOccupancy(terrain,x+dx!*1e-3,z+dz!*1e-3)==='land');
  it('closes every open bank edge against the land or under the water',()=>{
    const g=riverBanks(terrain,[])!,p=g.getAttribute('position'),ix=g.index!,count=new Map<string,number>(),key=(a:number,b:number)=>a<b?`${a}/${b}`:`${b}/${a}`;
    for(let i=0;i<ix.count;i+=3)for(let j=0;j<3;j++){const k=key(ix.getX(i+j),ix.getX(i+(j+1)%3));count.set(k,(count.get(k)??0)+1);}
    const exposed:number[][]=[];
    for(const [k,n] of count){if(n!==1)continue;const ends=k.split('/').map(Number);
      if(ends.every(i=>touchesLand(p.getX(i),p.getZ(i)))||ends.every(i=>p.getY(i)<=terrain.spec.water))continue;exposed.push(ends.flatMap(i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>+v.toFixed(2))));}
    expect(ix.count).toBeGreaterThan(300);expect(exposed).toEqual([]);g.dispose();
  });
  it('fills every stair notch of the low slanted banks level with the land; high cliffs keep their wall',()=>{
    const mesh=new Mesh(riverBanks(terrain,[])!,new MeshBasicMaterial()),ray=new Raycaster(),sunk:number[][]=[];let notches=0;
    for(let r=0;r<terrain.rows;r++)for(let c=0;c<terrain.columns;c++){
      if(kind(c,r)!=='water'||![kind(c-1,r),kind(c+1,r)].includes('land')||![kind(c,r-1),kind(c,r+1)].includes('land'))continue;
      const x=terrain.originX+(c+.5)*terrain.cellWidth,z=terrain.originZ+(r+.5)*terrain.cellDepth;notches++;
      ray.set(new Vector3(x,50,z),new Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];
      const banks=[[c,r],[c+1,r],[c,r+1],[c+1,r+1]].filter(([vc,vr])=>[kind(vc!-1,vr!-1),kind(vc!,vr!-1),kind(vc!-1,vr!),kind(vc!,vr!)].includes('land')).map(([vc,vr])=>terrain.heights[vr!*(terrain.columns+1)+vc!]!),bank=Math.min(...banks);
      if(bank-terrain.spec.water>BANK_HIGHEST){expect(hit,'a high cliff keeps its plain wall').toBeUndefined();continue;}
      // Where a low bank meets a high cliff the notch is part of either; only wholly low notches must be filled.
      if(Math.max(...banks)-terrain.spec.water>BANK_HIGHEST)continue;
      if(!hit||hit.point.y<bank-.08)sunk.push([x,z,hit?.point.y??NaN,bank].map(v=>+v.toFixed(2)));
    }
    expect(notches).toBeGreaterThan(20);expect(sunk).toEqual([]);mesh.geometry.dispose();
  });
  it('keeps the middle of the river open water',()=>{
    const mesh=new Mesh(riverBanks(terrain,[])!,new MeshBasicMaterial()),ray=new Raycaster(),filled:number[][]=[];let open=0;
    for(let z=-15;z<=15;z+=.25)for(let x=-6;x<=5;x+=.25){
      if(!pointInPolygon(river,x,z)||distanceToPolygon(river,x,z)<1.1||terrainOccupancy(terrain,x,z)!=='water')continue;open++;
      ray.set(new Vector3(x,50,z),new Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];
      if(hit&&hit.point.y>terrain.spec.water)filled.push([x,z,hit.point.y].map(v=>+v.toFixed(2)));
    }
    expect(open).toBeGreaterThan(50);expect(filled).toEqual([]);mesh.geometry.dispose();
  });
  it('leaves banks drawn along the grid as plain cliffs',()=>{
    for(const chapter of [0,1])expect(riverBanks(compileTerrain(villageScenePlan(chapter).terrain),[])).toBeNull();
  });
});

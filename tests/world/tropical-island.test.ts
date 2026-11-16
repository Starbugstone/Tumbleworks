import { Box3, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { compileTerrain, terrainHeightAt } from '../../src/world/village-terrain';
import { villageScenePlan } from '../../src/world/village-plans';
import { createVillageTerrain } from '../../src/view/village-terrain';
import { coastalEdges, coastSample, tropicalCoast } from '../../src/view/tropical-island';

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

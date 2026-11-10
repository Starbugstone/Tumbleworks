import {afterAll, beforeAll, expect, it, vi} from 'vitest';
import {BoxGeometry, Group, Matrix4, Mesh, MeshBasicMaterial} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {villageWorld} from './village-world-fixture';
import {assertStaticSupportCertificate,StaticProofPlan,type SealedStaticProof} from '../../src/view/static-support-graph';
import {assertNativeRange, assertNativeRanges, nativeSource, StaticNativeIssuer} from '../../src/view/static-support-native';
import {drain} from '../../src/view/cooperative';
import {runStaticProofRequest} from '../../src/view/static-support-proof';
import {nativeTerrainOwnership} from '../../src/view/village-terrain';

let f: ReturnType<typeof villageWorld>;
beforeAll(() => { f = villageWorld(0); }, 60000);
afterAll(() => f?.dispose());

it('scans each actual private source once and still reads every one of the131 range slices', () => {
 const inspection=f.probe.machine.staticSupportInspection()!,certificate=inspection.certificate!;
 const originals=new Set(inspection.native.map(r=>nativeSource(r).originalGeometry));
 const actuals=new Set(inspection.native.map(r=>nativeSource(r).mesh.geometry));
 const spies=[...originals,...actuals].map(g=>vi.spyOn(g,'getAttribute'));
 try {
  assertStaticSupportCertificate(certificate);
  const normalCalls=spies.map(s=>s.mock.calls.filter(([name])=>name==='normal').length);
  expect(normalCalls.slice(0,originals.size)).toEqual(Array(originals.size).fill(1));
  expect(normalCalls.slice(originals.size).reduce((n,c)=>n+c,0)).toBe(131+actuals.size);
  expect(originals.size).toBe(78);expect(actuals.size).toBe(10);
 } finally {spies.forEach(s=>s.mockRestore());}
});

it('standalone calls stay deep and no batch result survives another invocation, including failed checks', () => {
 const r=f.probe.machine.staticSupportInspection()!.native[0]!,s=nativeSource(r),g=s.mesh.geometry;
 const spy=vi.spyOn(g,'getAttribute');
 try {
  assertNativeRange(r);assertNativeRange(r);
  expect(spy.mock.calls.filter(([n])=>n==='normal')).toHaveLength(4);
  assertNativeRanges([r,r]);
  expect(spy.mock.calls.filter(([n])=>n==='normal')).toHaveLength(7);
  const p=g.getAttribute('position'),old=p.getX(0);
  try {p.setX(0,old+1);for(let k=0;k<2;k++)expect(()=>assertNativeRanges([r,r])).toThrow('Dirty support array');}
  finally {p.setX(0,old);}
  expect(()=>assertNativeRanges([r,r],true)).not.toThrow();
 } finally {spy.mockRestore();}
});

it('keeps every late per-range comparison after a shared whole source has passed', () => {
 const all=f.probe.machine.staticSupportInspection()!.native;
 const a=all.find(r=>all.some(s=>s!==r&&nativeSource(s).mesh===nativeSource(r).mesh))!;
 const mesh=nativeSource(a).mesh,b=all.find(r=>r!==a&&nativeSource(r).mesh===mesh)!,g=mesh.geometry;
 const p=g.getAttribute('position'),offset=b.first*3,old=p.array[offset]!;
 const get=g.getAttribute;let positionReads=0;
 // Fault injection after the successful whole-source scan, at the first slice.
 // No callback or extension point is passed to the production batch API.
 const spy=vi.spyOn(g,'getAttribute').mockImplementation(function(name){
  if(name==='position'&&++positionReads===2)p.array[offset]=old+1;
  return get.call(g,name);
 });
 try {expect(()=>assertNativeRanges([a,b])).toThrow('Wrong native range/content');}
 finally {p.array[offset]=old;spy.mockRestore();}
 expect(()=>assertNativeRanges([a,b])).not.toThrow();
});

it('keys by private Source identity rather than reused geometry and preserves detached versus attached frames', () => {
 const home=new Group(),geometry=new BoxGeometry().toNonIndexed(),material=new MeshBasicMaterial();
 geometry.deleteAttribute('uv');
 const a=new Mesh(geometry,material),b=new Mesh(geometry,material);home.add(a,b);
 const actualGeometry=mergeGeometries([geometry,geometry]),actual=new Mesh(actualGeometry,material);home.add(actual);
 const issuer=new StaticNativeIssuer(home),n=geometry.getAttribute('position').count;
 issuer.record('a',a);issuer.record('b',b);
 const x=issuer.bind(a,actual,0,n,geometry,new Matrix4(),home)!;
 const y=issuer.bind(b,actual,n,n,geometry,new Matrix4(),home)!;issuer.finish();
 try {
  a.visible=false;b.visible=false; // Detached-source visibility is not an attached-native guard.
  expect(()=>assertNativeRanges([x,y],true)).not.toThrow();
  b.position.x=1;
  expect(()=>assertNativeRanges([x,y])).toThrow('Stale detached source frame');
  b.position.x=0;b.updateMatrix();actual.visible=false;
  expect(()=>assertNativeRanges([x,y])).toThrow('Changed/hidden support relative frame');
  actual.visible=true;expect(()=>assertNativeRanges([x,y],true)).not.toThrow();
  expect(()=>assertNativeRanges([x,{...y}])).toThrow('Unissued native range');
 } finally {issuer.dispose();geometry.dispose();actualGeometry.dispose();material.dispose();}
});

it('atomic issuance still checks current ground bytes, identity, visibility and topology after the staged pass',()=>{
 let sealed:SealedStaticProof|undefined;
 const original=StaticProofPlan.prototype.seal;
 const spy=vi.spyOn(StaticProofPlan.prototype,'seal').mockImplementation(function(this:StaticProofPlan,...args){return sealed=original.apply(this,args);});
 let actual:ReturnType<typeof villageWorld>;
 try{actual=villageWorld(0,false,'held');}finally{spy.mockRestore();}
 try{
  const prepared=drain(sealed!.snapshot(()=>true)),reply=runStaticProofRequest(structuredClone(prepared.request,{transfer:[...prepared.transfer]}));
  expect(reply.outcome).toBe('certified');
  const ground=actual.world.scene.getObjectByName('village-landscape-0')!.children.find(o=>o instanceof Mesh)as Mesh;
  const mutateAndReject=(expected:string,mutate:()=>()=>void)=>{
   const accept=prepared.accept(reply,()=>true);
   for(let k=0;;k++){const next=accept.next();expect(next.done).toBe(false);if(next.value==='accept:pre-atomic')break;if(k>1000)throw Error('Missing atomic boundary');}
   const restore=mutate();try{expect(()=>accept.next()).toThrow(expected);}finally{restore();}
  };
  for(const name of ['position','normal','color'])mutateAndReject('Dirty support array',()=>{const a=ground.geometry.getAttribute(name).array,old=a[0]!;a[0]=old+1;return()=>{a[0]=old;};});
  mutateAndReject('Changed/hidden support relative frame',()=>{ground.visible=false;return()=>{ground.visible=true;};});
  mutateAndReject('Replaced support geometry/material',()=>{const g=ground.geometry;ground.geometry=g.clone();return()=>{ground.geometry.dispose();ground.geometry=g;};});
  const terrain=nativeTerrainOwnership(ground).terrain,heights=terrain.heights;
  mutateAndReject('Stale ground topology descriptor',()=>{const old=heights[0]!;heights[0]=old+1;return()=>{heights[0]=old;};});
  const certificate=drain(prepared.accept(reply,()=>true));
  expect(certificate.edges).toHaveLength(1211);assertStaticSupportCertificate(certificate);
 }finally{actual.dispose();}
},60000);

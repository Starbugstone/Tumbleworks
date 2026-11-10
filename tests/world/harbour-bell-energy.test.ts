import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {Vector3} from 'three';
import {villageScenePlan} from '../../src/world/village-plans';
import {validateVillagePlan,assertVillagePortMatch} from '../../src/world/village-program';
import {compileTerrain} from '../../src/world/village-terrain';
import {actualFootPatch} from './pendulum-feet';
import type {VillageStation,VillageConnector} from '../../src/world/village-plan';
const before=JSON.parse(readFileSync('tests/world/fixtures/harbour-upper-route.json','utf8'));
const scene=villageScenePlan(0),p=scene.plan,station=(n:number)=>p.stations.find(s=>s.stop===n)!;
it('keeps at least one metre of gravity head below the unchanged slip hold',()=>{
 const s=station(2),m=s.mechanism;if(m.kind!=='translating'||!s.retention)throw new Error('Slip required');
 const hold=s.anchor[1]+m.travel[1]+s.retention.captureStart*Math.sin(m.deckPitch??0);
 expect(hold-station(1).anchor[1]).toBeGreaterThanOrEqual(1);
});
it('retains every upper authored frame, support, source and camera field exactly',()=>{
 expect(p.stations.filter(s=>s.stop>=2).map(s=>{const{terrainFeet,bearingSeats,...same}=s;void terrainFeet;void bearingSeats;return same;})).toEqual(before.stations);
 expect(JSON.parse(JSON.stringify(p.connectors.filter(s=>s.to>=2).map(l=>{const{terrainFeet,terrainFrameFeet,bearingSeats,omitAutomaticFrames,fixedEnds,...same}=l;void terrainFeet;void terrainFrameFeet;void bearingSeats;void omitAutomaticFrames;void fixedEnds;return same;})))).toEqual(before.connectors);expect(p.camera).toEqual(before.camera);
});
it('descends continuously over nonzero forward cells into matching real berth frames',()=>{
 validateVillagePlan(p);const link=p.connectors.find(s=>s.from===2)!;
 assertVillagePortMatch(link.points[0]!,station(2).exit);assertVillagePortMatch(link.points.at(-1)!,station(1).entry);
 for(let i=0;i<link.points.length;i++){
  const a=link.points[i]!,t=new Vector3(...a.tangent),n=new Vector3(...a.normal);
  expect([...a.position,...a.tangent,...a.normal,a.width].every(Number.isFinite)).toBe(true);
  expect(t.length()).toBeCloseTo(1,12);expect(n.length()).toBeCloseTo(1,12);expect(t.dot(n)).toBeCloseTo(0,12);
  if(!i)continue;const b=link.points[i-1]!,delta=new Vector3(...a.position).sub(new Vector3(...b.position));
  expect(a.position[1]).toBeLessThanOrEqual(b.position[1]);expect(delta.length()).toBeGreaterThan(0);
  expect(delta.dot(t)).toBeGreaterThan(0);expect(delta.dot(new Vector3(...b.tangent))).toBeGreaterThan(0);
  expect(a.width).toBe(b.width);expect(t.dot(new Vector3(...b.tangent))).toBeGreaterThan(.99);
  expect(n.dot(new Vector3(...b.normal))).toBeGreaterThan(.99);
 }
});
it('moves the chosen berth upper surfaces by T and grounds its unchanged hardware on full land patches',()=>{
 const shift=(v:readonly number[])=>[v[0]!,v[1]!-.85,v[2]!+5];
 const near=(a:readonly number[],b:readonly number[])=>a.forEach((v,i)=>expect(v).toBeCloseTo(b[i]!,12));
 for(const old of before.berthStations as VillageStation[]){const now=station(old.stop);
  near(now.anchor,shift(old.anchor));for(const key of ['entry','exit'] as const){near(now[key].position,shift(old[key].position));expect(now[key].tangent).toEqual(old[key].tangent);expect(now[key].normal).toEqual(old[key].normal);expect(now[key].width).toBe(old[key].width);}
  expect(now.mechanism).toEqual(old.mechanism);expect(now.retention).toEqual(old.retention);expect(now.terminalCapture).toEqual(old.terminalCapture);
  for(const [i,v] of (old.supports??[]).entries())near(now.supports![i]!,shift(v));
 }
 const old=before.berthLink as VillageConnector,now=p.connectors.find(s=>s.from===1)!;
 old.points.forEach((v,i)=>{near(now.points[i]!.position,shift(v.position));expect(now.points[i]!.tangent).toEqual(v.tangent);expect(now.points[i]!.normal).toEqual(v.normal);});
 old.supports!.forEach((v,i)=>near(now.supports![i]!,shift(v)));
 const d=station(1).strikerDrive!,od=before.berthStations.find((s:VillageStation)=>s.stop===1).strikerDrive;
 if(d.kind!=='pendulum')throw new Error('Pendulum required');
 const {axle,footings,...hardware}=d;const {axle:oa,footings:of,...original}=od;
 expect(hardware).toEqual(original);near(axle.origin,shift(oa.origin));expect(axle.axis).toEqual(oa.axis);
 const terrain=compileTerrain(scene.terrain);
 footings.forEach((f,i)=>{expect(f.x).toBe(of[i].x);expect(f.z).toBeCloseTo(of[i].z+5,12);expect(f.half).toBe(of[i].half);const a=actualFootPatch(terrain,f);expect(a.maximumHeightError).toBe(0);expect(Math.abs(a.area-a.expectedArea)).toBeLessThan(128*Number.EPSILON);});
 expect(scene.scenery.find(s=>s.model==='boat')?.position).toEqual([9.6,-.25,10]);
});

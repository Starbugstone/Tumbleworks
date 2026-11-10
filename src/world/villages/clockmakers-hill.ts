import { villagePort } from '../village-plan';
import type { VillageScenePlan } from '../village-plans';
import type { VillageTerrainSpec } from '../village-terrain';
import { workshopSite } from '../workshop-building';
import { connect, connectVia, groundOf, piece, schedule, shots, station, straight, track, turn } from './author';

const terrain: VillageTerrainSpec = {
  size: [30, 34], cells: [54, 62], base: 0.2, water: -1, skirtDepth: 2,
  outline: [[-13,-13],[-7,-16],[6,-16],[13,-10],[14,6],[8,15],[-8,15],[-14,5]],
  features: [
    { kind: 'mound', centre: [0,-3], radii: [12,13], height: 2.4 },
    { kind: 'mound', centre: [0,-6], radii: [5,5], height: 2.8 },
  ],
  palette: { grass: 0x82918b, grassAlt: 0x75877d, rock: 0x777b78, shore: 0xb7aa87, water: 0x528a94, cliff: 0x59645e },
};
const { at } = groundOf(terrain);
const beats = schedule(0.3, [[1.7,.5],[1.5,.5],[2.4,.5],[1.5,.5],[1.4,1.3],[1.5,.5],[1.4,1.3],[1.5,1.3],[1.5,.5],[1.5,0]]);
const brass = 0xc7aa70;
// The hill spirals out from its narrow summit onto a broad, asymmetric foot.
const stations = [
  { ...track(9,'channel',straight([-5.8,9.5,-11],[-4.2,8.6,-11],8),beats[0]!,[-5,5.5,-9.5],brass), releasePin:true },
  station({ stop: 8, anchor: [1,8.2,-11], badge: [3.5, 7, -10], mechanism: { kind:'escapement', travel:.65, pitch:-.18,
    drive:{marbleMass:.02,rotorEnergy:.05,rotorInertia:.00016,dragTorque:.002,gateMass:.002,gateLift:1.2,riseAngle:Math.PI/2} }, beat:beats[1]!, color:brass }),
  track(7,'helix',turn([0,8,-5],2.8,-Math.PI/2,Math.PI*2,-2.4,96),beats[2]!,[2.5, 5, -3.5],brass,{anchor:[0,5.5,-5]}),
  station({ stop:6, anchor:[6,7,-3], badge:[6.5, 7.5, -4.5], mechanism:{kind:'turntable',pivot:[0,-.8,0],axis:[0,1,0],angle:-Math.PI/2,deckPitch:-.35,dockingLift:.45},beat:beats[3]!,color:brass }),
  track(5,'arc',turn([8,4.5,2],1.5,Math.PI/2,-Math.PI*.7,-.4),beats[4]!,[7.5, 3.5, 3],brass),
  station({stop:4,anchor:[5,3.8,7],badge:[6, 2.3, 9],mechanism:{kind:'striker',travel:.5},beat:beats[5]!,color:brass}),
  track(3,'channel',straight([.8,3.3,10],[-1.2,3.3,10]),beats[6]!,[-1.5, 3.8, 9],brass),
  station({stop:2,anchor:[-6,4.2,7],badge:[-4.5, 4, 5],mechanism:{kind:'bridge',pivot:[0,-.8,0],axis:[0,1,0],angle:Math.PI/3,deckPitch:-.35,dockingLift:.45},beat:beats[7]!,color:brass}),
  station({stop:1,anchor:[-7,3.8,1],badge:[-4.5, 4.5, 0],mechanism:{kind:'wheelbucket',radius:.7,angle:-Math.PI,deckPitch:-.35},beat:beats[8]!,color:brass}),
  station({stop:0,anchor:[-7,4,-5],badge:[-9.5, 6, -6.5],mechanism:{kind:'receiver',travel:0},beat:beats[9]!,color:brass}),
].map(station => [6,2,1].includes(station.stop) ? { ...station, retention: {
  marbleMass:.02,headMass:.001,brakeForce:5,captureStart:station.stop === 1 ? .25 : -.25,captureStroke:.3,
  bodyMass:.08,bodyInertia:.022,rotorInertia:station.stop === 1 ? .004 : 0,weightMass:station.stop !== 1 ? 4 : .4,weightDrop:.8,
  acceleration:station.stop !== 1 ? 7 : 2,gateSeconds:.3,gateMass:.003,
} } : station.stop === 4 ? { ...station, strikerDrive: { mass:.001,inertia:.000095,friction:.05,stroke:.5 } } : station);
const connectors = stations.slice(0,-1).map((from,i) => from.stop===5 ? connectVia(from,stations[i+1]!, [
  {via:villagePort([1,4,5],[0,0,1]),out:2.5,in:2.5,steps:48},
  {out:1.2,in:1.5,steps:32},
]) : from.stop===4 ? connectVia(from,stations[i+1]!, [
  {via:villagePort([6.8,3.55,7],[1,0,0]),out:.3,in:.3,steps:16},
  {via:villagePort([8.3,3.55,8.5],[0,0,1]),out:.83,in:.83,steps:24},
  {via:villagePort([6.8,3.55,10],[-1,0,0]),out:.83,in:.83,steps:24},
  {out:2,in:2,steps:24},
]) : from.stop===3 ? connectVia(from,stations[i+1]!, [
  {via:villagePort([-8,4.2,10],[-1,0,0]),out:2,in:2,steps:32},
  {via:villagePort([-9.5,4.3,8.5],[0,0,-1]),out:.83,in:.83,steps:24},
  {via:villagePort([-8,4.45,7],[1,0,0]),out:.83,in:.83,steps:24},
  {out:.3,in:.3,steps:16},
]) : from.stop===2 ? connectVia(from,stations[i+1]!, [
  {via:villagePort([-4.5,3.85,3],[0,0,-1]),out:1,in:1,steps:32},
  {via:villagePort([-4.5,3.6,1],[-1,0,0]),out:.8,in:.8,steps:32},
  {out:.4,in:.4,steps:32},
]) : connect(from,stations[i+1]!,[9,6,5,2].includes(from.stop)?1.2:3.2,[9,6,5,2].includes(from.stop)?1.2:3.2,[0,0],{lead:0.8,steps:64}));
const scenery = [piece('clock',[9,at(9,-10),-10],0,.8),piece('house-a',[-10,at(-10,10),10],.3,.65),piece('tree-a',[10,at(10,8),8],0,.75)];
export const CLOCKMAKERS_HILL: VillageScenePlan = {
  chapter:3, construction:'swing', terrain, scenery,
  plan:{chapter:3,profile:'twinrail',stations,connectors,camera:shots([0,2.5,0],[
    {at:2.2,target:[0,6,-7],radius:30},{at:7.1,target:[4,4,-1],radius:28},
    {at:11,target:[2,3,7],radius:28},{at:15.7,target:[-6,3,3],radius:28},{at:21.4,target:[0,2.5,0],radius:66},
  ])},
  workshop:workshopSite({position:[-10,at(-10,-2),-2],scale:.7,yaw:Math.PI/2},[-12.5, 0.854, 0],{from:1,to:0}),
  rewards:[{project:'board-211',position:[10,at(10,-3),-3],yaw:0}],
  overview:[piece('clock',[3.5,at(3.5,-7),-7],0,1),piece('mechanism-gear',[-3,at(-3,1),1],0,1.4),piece('house-a',[-6,at(-6,8),8],0,.8)],
};

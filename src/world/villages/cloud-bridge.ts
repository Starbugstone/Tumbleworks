import { villagePort } from '../village-plan';
import type { VillageScenePlan } from '../village-plans';
import type { VillageTerrainSpec } from '../village-terrain';
import type { VillageVec3 } from '../village-plan';
import { workshopSite } from '../workshop-building';
import { connect, connectVia, groundOf, piece, schedule, shots, station, straight, track, turn } from './author';

// Opposed diagonal bridgeheads, with a low continuous ravine floor visible between them.
const terrain: VillageTerrainSpec = {
  size:[32,36],cells:[64,72],base:-1,water:-2,skirtDepth:2,
  outline:[[-15,-15],[12,-17],[15,-10],[15,12],[9,17],[-12,16],[-15,8]],
  features:[
    {kind:'plateau',polygon:[[-13,0],[-3,0],[-3,14],[-13,14]],height:3,skirt:1.5},
    {kind:'plateau',polygon:[[2,-14],[13,-14],[13,-1],[2,-1]],height:5,skirt:1.5},
    {kind:'paint',polygon:[[-2,-16],[1,-16],[1,16],[-2,16]],color:0x73949c},
  ],
  palette:{grass:0x899790,grassAlt:0x9aa69a,rock:0x79828a,shore:0xa7a89d,water:0x729eae,cliff:0x687580},
};
const {at}=groundOf(terrain);
const beats=schedule(.3,[[2.2,.5],[1.2,.5],[1.3,.5],[1.2,1],[2.2,.5],[1.2,.5],[1.3,.5],[1.8,.5],[1.4,.5],[1.4,0]]);
const steel=0x9aaeb0;
const banks: readonly VillageVec3[]=[[-5,5.5,3],[7,6.5,-4]];
const stations=[
  station({stop:9,anchor:[-6,6,9],badge:[-5, 4.5, 11],mechanism:{kind:'suspended',travel:[10,1,-13]},beat:beats[0]!,color:steel,span:'cable',supports:[[-6,8,9],[4,9,-4]]}),
  track(8,'channel',straight([4.8,7,-9],[7,7,-9]),beats[1]!,[9.5, 8, -7.5],steel),
  track(7,'channel',turn([7,7,-13],1.5,0,Math.PI,0),beats[2]!,[5.5, 9, -14],steel),
  track(6,'channel',straight([2.5,7,-9],[.5,7,-7]),beats[3]!,[-0.5, 6.5, -11],steel,{span:'girder',supports:[[3,6.5,-9],[3,6.5,-7]]}),
  station({stop:5,anchor:[0,6,-3],badge:[4, 3.5, -1],mechanism:{kind:'bridge',pivot:[0,-.8,0],axis:[0,1,0],angle:-Math.PI/2,dockingLift:.45},beat:beats[4]!,color:steel,span:'cable',supports:banks}),
  track(4,'channel',straight([-5,5,0],[-7,5,0]),beats[5]!,[-7.5, 6, -1],steel),
  station({stop:3,anchor:[-7,5,5],badge:[-10, 3, 7.5],mechanism:{kind:'striker',travel:.6},beat:beats[6]!,color:steel}),
  station({stop:2,anchor:[0,5,5],badge:[0, 3, 7],mechanism:{kind:'translating',travel:[0,-3,0]},beat:beats[7]!,color:steel,span:'girder',supports:[[-2,1.5,7],[2,1.5,7]]}),
  track(1,'arc',turn([4,2,8],3,Math.PI/2,-Math.PI/2,0),beats[8]!,[7, 2, 5],steel),
  station({stop:0,anchor:[10,2,12],badge:[11, 4, 10],mechanism:{kind:'receiver',travel:0},beat:beats[9]!,color:steel}),
];
const connectors=stations.slice(0,-1).map((from,i)=>from.stop===6 ? connectVia(from,stations[i+1]!, [
  {via:villagePort([-3,6.5,-5],[0,0,1]),out:1.4,in:1.3,steps:64},
  {out:1.2,in:1.2,steps:64},
]) : from.stop===9 ? connect(from,stations[i+1]!,2,2,[0,0],{steps:64})
  : connect(from,stations[i+1]!,from.stop===2?.4:[8,7,6,5,1].includes(from.stop)?1.2:3.2,from.stop===2?.4:[8,7,6,5,1].includes(from.stop)?1.2:3.2,[0,0],{lead:0.8,steps:64}));
export const CLOUD_BRIDGE: VillageScenePlan={chapter:4,construction:'drop',terrain,
  plan:{chapter:4,profile:'girder',stations,connectors,camera:shots([0,2.5,0],[
    {at:2.7,target:[5,6,-9],radius:30},{at:6.2,target:[0,5,-4],radius:32},
    {at:11.1,target:[-5,4,2],radius:28},{at:14.6,target:[1,3,6],radius:30},{at:18.7,target:[0,2.5,0],radius:66},
  ])},
  scenery:[piece('house-b',[10,at(10,-5),-5],-.4,.7),piece('house-a',[-11,at(-11,11),11],.3,.7),piece('tree-a',[11,at(11,-12),-12],0,.65)],
  workshop:workshopSite({position:[-12.25,at(-12.25,2.5),2.5],scale:.65,yaw:Math.PI/2},[-13, 5.5, 1.5],{from:4,to:3}),
  rewards:[{project:'loop-211',position:[10,at(10,10),10],yaw:0}],
  overview:[piece('house-b',[7,at(7,-8),-8],0,1),piece('bridge',[0,-.5,0],-.65,1.2),piece('house-a',[-7,at(-7,8),8],0,1)],
};

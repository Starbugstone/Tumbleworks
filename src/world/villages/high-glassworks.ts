import { villagePort } from '../village-plan';
import type { VillageScenePlan } from '../village-plans';
import type { VillageTerrainSpec } from '../village-terrain';
import { workshopSite } from '../workshop-building';
import { connect, connectVia, groundOf, piece, schedule, shots, spiralBowl, station, straight, track, turn, verticalLoop } from './author';

// Open-front amphitheatre: the chimneys stay behind the playable tiers.
const terrain:VillageTerrainSpec={size:[32,34],cells:[64,68],base:.2,water:-1,skirtDepth:2,
  outline:[[-14,-14],[-8,-16],[9,-16],[14,-11],[14,12],[9,15],[-9,15],[-14,10]],
  features:[
    {kind:'plateau',polygon:[[-12,-14],[12,-14],[12,-9],[-12,-9]],height:3.4,skirt:1},
    {kind:'plateau',polygon:[[-12,-9],[12,-9],[12,-3],[-12,-3]],height:2.1,skirt:1},
    {kind:'plateau',polygon:[[-12,-3],[12,-3],[12,3],[-12,3]],height:1,skirt:1},
  ],palette:{grass:0x8c9395,grassAlt:0x9aa0a1,rock:0x777d83,shore:0xb5b6ad,water:0x59858e,cliff:0x626c75},
};
const {at}=groundOf(terrain);
const beats=schedule(.3,[[1.5,.5],[1.4,.5],[1.5,.5],[1.4,.5],[1.5,.5],[2,.5],[1.7,.5],[1.3,2.5],[1.5,.5],[1.5,0]]);
const steel=0xb7c9ca;
const stations=[
  station({stop:9,anchor:[-6,6,-11],badge:[-7, 8.5, -12],mechanism:{kind:'tipping',pivot:[0,-.8,0],axis:[0,0,1],angle:-.35},beat:beats[0]!,color:steel}),
  track(8,'channel',straight([-1,5.6,-11],[2,5,-11]),beats[1]!,[1.5, 6.6, -11.5],steel),
  station({stop:7,anchor:[7,5,-8],badge:[8, 7, -9.5],mechanism:{kind:'tipping',pivot:[-.8,-.8,0],axis:[0,0,1],angle:-.35},beat:beats[2]!,color:steel}),
  track(6,'channel',straight([4,4.6,-4],[1,4,-4]),beats[3]!,[1.5, 5, -5],steel),
  track(5,'arc',turn([-5,4,-4],1.6,Math.PI/2,Math.PI/2,-.4),beats[4]!,[-8, 4, -4],steel),
  track(4,'loop',verticalLoop([-5,3,2],4.6,1.5),beats[5]!,[-3.5, 4.5, 0.5],steel),
  // The open back half descends without returning under its incoming channel.
  track(3,'bowl',spiralBowl([2,3.5,2],2,1,0,.5,1),beats[6]!,[2, 4.5, 1.5],steel),
  track(2,'channel',straight([6,2.5,5],[6,2.5,7]),beats[7]!,[6.5, 4.5, 2],steel),
  station({stop:1,anchor:[-2,2.5,10],badge:[0.5, 2.5, 10],mechanism:{kind:'suspended',travel:[0,1,0]},beat:beats[8]!,color:steel}),
  station({stop:0,anchor:[9,4,10],badge:[9, 2.5, 12],mechanism:{kind:'receiver',travel:0},beat:beats[9]!,color:steel}),
];
const connectors=stations.slice(0,-1).map((from,i)=>from.stop === 2 ? connectVia(from,stations[i+1]!,[
  {via:villagePort([4,2.5,12],[-1,0,0]),out:1.2,in:2,steps:48},
  {via:villagePort([-6,2.5,11],[0,0,-1]),out:3,in:2,steps:48},
  {out:2,in:2,steps:48},
]) : from.stop===3 ? connectVia(from,stations[i+1]!,[
  {via:villagePort([2.5,2.5,3.5],[1,0,0]),out:.83,in:.83,steps:32},
  {via:villagePort([4.5,2.5,3.5],[1,0,0]),out:2/3,in:2/3,steps:8},
  {out:.83,in:.83,steps:32},
]) : connect(from,stations[i+1]!,[9,8,6,4].includes(from.stop)?1.2:3.2,from.stop===4?2.4:[9,8,6].includes(from.stop)?1.2:3.2,[0,0],{lead:0.8,steps:64}))
  .map(link=>link.from===1?{...link,supportIndices:[2,link.points.length-3]}:link.from===4?{...link,refineFloor:true,supportIndices:[2,link.points.length-3]}:link.from===3?{...link,refineFloor:true}:link);
export const HIGH_GLASSWORKS:VillageScenePlan={chapter:5,construction:'rise',terrain,
  plan:{chapter:5,profile:'steel',stations,connectors,camera:shots([0,2.5,0],[
    {at:2.1,target:[2,5,-10],radius:30},{at:6,target:[-2,4,-3],radius:30},
    {at:9.9,target:[-3,4,2],radius:30},{at:14.6,target:[4,3,6],radius:28},{at:20.4,target:[0,2.5,0],radius:66},
  ])},
  scenery:[piece('glassworks',[-2,at(-2,-14),-14],0,.7),piece('glassworks',[8,at(8,-14),-14],0,.55),piece('warehouse',[-11,at(-11,-8),-8],Math.PI/2,.6)],
  workshop:workshopSite({position:[10,at(10,4),4],scale:.7,yaw:-Math.PI/2},[10.5, 3.2, 3.5],{from:3,to:2}),
  rewards:[{project:'tube-211',position:[-11,at(-11,8),8],yaw:0}],
  overview:[piece('glassworks',[-5,at(-5,-11),-11],0,1),piece('glassworks',[5,at(5,-11),-11],0,.8),piece('mechanism-funnel',[2,at(2,4),4],0,1.2)],
};

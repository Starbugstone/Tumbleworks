import { villagePort, type VillageVec3 } from '../village-plan';
import type { VillageScenePlan } from '../village-plans';
import type { TerrainVec2, VillageTerrainSpec } from '../village-terrain';
import { workshopSite } from '../workshop-building';
import { connect, connectVia, groundOf, piece, schedule, shots, spiralBowl, station, straight, track, turn } from './author';

const outline: TerrainVec2[] = [
  [-14.5,-7.5],[-13.5,-13.6],[-8.8,-16.2],[-2,-14.6],[1,-13.8],[5.2,-15.8],[11.4,-14.8],[14.6,-9.8],[15.2,-3],[15.2,4],
  [14.0,10.5],[9.4,14.6],[3,14.8],[-2,12.8],[-6.5,14.8],[-11.5,13.2],[-14.4,9.2],[-15.2,2],
];
const terrain: VillageTerrainSpec = {
  size:[34,34], cells:[64,64], base:.28, water:-.82, skirtDepth:1.75, beachWidth:1.65, outline,
  smoothLandNormals:true, rockContour:true,
  features:[
    {kind:'mound',centre:[-8.7,-8.2],radii:[7.5,7.8],height:2.67},
    {kind:'mound',centre:[7.8,-7.2],radii:[7.2,8.4],height:2.04},
    {kind:'mound',centre:[-.6,-7.6],radii:[3.2,4.4],height:-.24},
    {kind:'paint',polygon:[[-12,-9],[-5,-11],[-2,-6],[-4,-3],[-11,-3]],color:0xb29f83},
    {kind:'paint',polygon:[[3,-9],[9,-11],[12,-7],[11,-2],[6,-2]],color:0xc3b39a},
    {kind:'paint',polygon:[[-10,4],[-6,2],[-1,3],[2,8],[-3,10],[-9,8]],color:0xc4b395},
  ],
  palette:{grass:0x8d9574,grassAlt:0xaaa27d,shore:0xc5ad8a,rock:0x9b7761,cliff:0x795e50,water:0x527c80},
};
const {at}=groundOf(terrain);
const chalk=0xe3d9b8;
const beats=schedule(.3,[[1.2,.7],[1.6,.6],[1.4,.6],[2.1,.8],[2.1,.7],[1.3,.6],[1.4,.6],[1.7,.8],[1.4,.9],[1.4,0]]);
const stations=[
  {...track(9,'channel',straight([-8.7,5.25,-10.3],[-7.95,4.90,-8.9],4),beats[0]!,[-8.9,6.6,-11.8],chalk),releasePin:true},
  track(8,'bowl',spiralBowl([-5.5,4.78,-5.65],2.35,1.68,Math.PI/2,-.25,1.18,.19,80),beats[1]!,[-4.9,5.9,-7.1],chalk),
  track(7,'channel',straight([-2.8,2.88,-2.85],[1.1,2.48,1.30],6),beats[2]!,[-2.4,3.8,-1.0],chalk),
  station({stop:6,anchor:[5.3,2.23,4.6],badge:[3.4,3.9,4.4],mechanism:{kind:'turntable',pivot:[0,-.84,0],axis:[0,1,0],angle:-Math.PI/2,dockingLift:.48},beat:beats[3]!,color:chalk}),
  station({stop:5,anchor:[7.0,1.92,9.2],badge:[7.3,3.8,10],mechanism:{kind:'translating',travel:[0,3.48,0]},beat:beats[4]!,color:chalk}),
  track(4,'arc',turn([9.3,5.4,6.25],2.95,-Math.PI/2,Math.PI/2,-.28,24),beats[5]!,[10.3,6.8,5],chalk),
  track(3,'arc',turn([8.3,5.04,-3.2],3.55,0,2.27,-.42,48),beats[6]!,[9.1,6.2,-5.6],chalk,{anchor:[9.2,4.55,-5.6]}),
  track(2,'channel',straight([2.75,4.44,-3.12],[-3.8,4.07,3.75],8),beats[7]!,[2.1,6.1,-4.4],chalk,{
    span:'girder',supports:[[2.75,4.44,-3.12],[-3.8,4.07,3.75]],
  }),
  {...station({stop:1,anchor:[-6.9,3.26,8.9],badge:[-8.1,4.2,7.5],mechanism:{kind:'striker',travel:.45},beat:beats[8]!,color:chalk}),strikerDrive:{mass:.001,inertia:.000095,friction:.05,stroke:.45}},
  station({stop:0,anchor:[-.45,2.73,10.3],badge:[-.65,3.7,11.9],mechanism:{kind:'receiver',travel:.12},beat:beats[9]!,color:chalk}),
];
const connectors=stations.slice(0,-1).map((from,i)=>{
  const to=stations[i+1]!;
  if(from.stop===2)return connectVia(from,to,[
    {via:villagePort([-8.4,3.68,6.3],[-.72,0,Math.sqrt(1-.72*.72)]),out:2.2,in:1.35,steps:28},
    {via:villagePort([-8.9,3.44,7.6],[0,0,1]),out:.52,in:.48,steps:20},
    {out:.80,in:.7,steps:24},
  ]);
  const handles: Record<number,[number,number]>={9:[.7,.81],8:[1.1,.98],7:[1.60,.88],6:[1.9,1.24],5:[.52,.57],4:[2.3,3.0],3:[1.6,1.45],1:[1.8,1.7]};
  const [a,b]=handles[from.stop]!;
  return {...connect(from,to,a,b,[0,0],{steps:48}),refineFloor:true};
});

const lots: readonly (readonly [string,number,number,number,number])[] = [
  ['beehive-kiln',-1.9,5.3,-0.16,0.96],
  ['ware-rack',1.1,6.0,-0.25,0.84],
  ['potter',-4.15,7.1,0.52,1.02],
  ['potter',3.3,6.1,0.78,1.02],
  ['pottery-shed',-10.9,-4.9,0.4,0.9],
  ['ware-rack',-8.1,-3.9,-0.1,0.84],
  ['potter',-9.9,-2.65,0.4,0.98],
  ['pottery-shed',-6.4,-12.2,-0.25,0.85],
  ['beehive-kiln',4.7,-11.4,-0.20,1.15],
  ['beehive-kiln',9.5,-10.6,-0.34,0.78],
  ['pottery-shed',0.6,-10.9,-0.14,0.90],
  ['ware-rack',2.8,-7.8,0.34,0.75],
  ['potter',6.9,-4.6,-0.45,1.02],
  ['pottery-shed',-11.4,3.15,0.48,0.92],
  ['ware-rack',-10.1,0.75,0.6,0.65],
  ['pollard',-11.2,7.2,0.56,0.78],
  ['pollard',-2.0,-11.2,-0.65,0.72],
  ['pollard',11.3,-6.4,0.35,0.74],
  ['pollard',-4.0,-12.2,0.7,0.7],
  ['ware-rack',-5.3,5.2,0.24,0.72],
  ['ware-rack',-7.75,-10.1,0.35,0.77],
  ['pottery-shed',-9.1,10.2,-0.42,0.84],
  ['ware-rack',-6.6,11.5,-0.28,0.68],
  ['fell-scrub',-12.1,-0.35,0.1,0.82],
  ['fell-scrub',12.2,-4.4,0.3,0.70],
  ['pottery-shed',9.4,10.0,-0.78,0.8],
  ['ware-rack',6.7,11.4,-0.38,0.74],
];
// Half extents of each building lot, including overhanging roofs and jar racks.
const yards: Record<string, readonly [number, number]> = {
  'beehive-kiln':[1.49,1.49], 'ware-rack':[1.09,.40], 'pottery-shed':[1.18,1.28],
  potter:[.28,.45], 'plaster-terrace':[.83,.71], pollard:[1.05,.81], 'fell-scrub':[1.44,.82],
};
const flatYards = lots.map(([model,x,z,yaw,scale])=>{
  const [width,depth] = yards[model]!;
  const halfX = scale*width+.56, halfZ = scale*depth+.56;
  const outline: TerrainVec2[] = [[-halfX,-halfZ],[halfX,-halfZ],[halfX,halfZ],[-halfX,halfZ]]
    .map(([u,w])=>[x+u!*Math.cos(yaw)+w!*Math.sin(yaw),z-u!*Math.sin(yaw)+w!*Math.cos(yaw)]);
  return {outline,height:at(x,z),apron:.52};
});
const cinematicTerrain={...terrain,buildingPads:flatYards};
const ground=groundOf(cinematicTerrain).at;
const scenery=lots.map(([model,x,z,yaw,scale])=>piece(model,[x,ground(x,z),z],yaw,scale));
const house:VillageVec3=[-7.7,at(-7.7,1.8),1.8];
export const POTTERS_REACH:VillageScenePlan={
  chapter:7,construction:'drop',terrain,cinematicTerrain,
  scenery,workshop:workshopSite({position:house,yaw:.35,scale:.76},[-8.7,5.2,.5],{from:2,to:1}),rewards:[],
  overview:[piece('beehive-kiln',[5.6,at(5.6,-6.5),-6.5],-0.2,1.10),piece('pottery-shed',[-7,at(-7,-7),-7],.3,1.18),piece('ware-rack',[-2.5,at(-2.5,5.5),5.5],-.25,1)],
  plan:{chapter:7,profile:'stoneware',stations,connectors,camera:shots([0,2.5,0],[
    {at:3.9,target:[-4,3.8,-5],radius:31},{at:7.9,target:[3.4,2.7,4.6],radius:29},
    {at:12.7,target:[8.1,4.2,5.8],radius:34},{at:16.5,target:[3,3.8,-3],radius:36},
    {at:20.5,target:[-4.6,3.0,6.8],radius:33},
  ])},
};

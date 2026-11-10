// UNUSED new field proposal only. The route owner re-checks the captured source
// SHA and applies it; this file never saves or modifies a live plan.
import type {VillageStation} from '../../src/world/village-plan';
import type {PendulumDrive} from '../../src/world/pendulum-types';
import { pendulumBar } from '../../src/view/pendulum-parts';
export function proposedPendulum(station:VillageStation,dress:'harbour-bell'|'mill-paddle',ground:(x:number,z:number)=>number|undefined):PendulumDrive{
 const old=station.strikerDrive;if(!old||'kind'in old&&old.kind==='pendulum')throw new Error('Expected captured legacy route fields');
 const arm=1.6,origin=[station.anchor[0]-.3,station.anchor[1]+arm,station.anchor[2]] as const;
 // arm/offset support the default .7 stop clearing the floor-centred sphere
 // before the .8 deck exit; these are UNSOLVED initial hardware dimensions,
 // never adjusted to rescue bearing static hold or friction losses.
 const base:PendulumDrive={kind:'pendulum',mass:old.mass,legacyGuideWork:{friction:old.friction,stroke:old.stroke},axle:{origin,axis:[0,0,1]},bar:{arm,radius:.04,length:.56,facets:16},stopAngle:1.4*old.stroke,dress,footings:[]};
 const bar=pendulumBar(base);let support=-Infinity;
 try{const p=bar.getAttribute('position');for(let i=0;i<p.count;i++)support=Math.max(support,p.getX(i));}finally{bar.dispose();}
 const x=origin[0]+arm*Math.sin(base.stopAngle)+(support+.04)*Math.cos(base.stopAngle);
 const feet=[[origin[0],origin[2]-.65],[origin[0],origin[2]+.65],[x,origin[2]-.62]] as const;
 // The frame-post buffer packs its translated z endpoints. Enclose those
 // endpoints exactly; the terrain patch is not a clearance tolerance.
 const packedHalf=Math.max(Math.fround(.07),Math.abs(Math.fround(.65+.07)-.65),Math.abs(Math.fround(.65-.07)-.65));
 const footings=feet.map(([x,z])=>{const half=packedHalf,heights=[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b])=>ground(x+a!*half,z+b!*half));if(heights.some(h=>h===undefined))throw new Error('Proposed foot crosses actual terrain void');return {x,z,half,heights:heights as [number,number,number,number]};});
 return {...base,footings};
}

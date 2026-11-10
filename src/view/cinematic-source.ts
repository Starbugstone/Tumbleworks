import type {VillageStation,VillageVec3} from '../world/village-plan';
import {sourceMountLayout,type SourceMountLayout} from './counterweight';

export interface CinematicSource extends SourceMountLayout {
  readonly post?:{readonly centre:VillageVec3;readonly size:VillageVec3};
}
/** Drawn source construction, separate from the offline force model. Its mast
 * supports the pulley beam; an upward lift never drives its collar through it. */
export function cinematicSource(station:VillageStation,stroke:number,ground:(x:number,z:number)=>number|undefined,offset?:number):CinematicSource {
  const original=sourceMountLayout(station,stroke,ground),a=station.anchor,m=station.mechanism;
  const travel='travel'in m&&typeof m.travel!=='number'?m.travel:undefined;
  const vertical=travel!==undefined&&Math.hypot(travel[0],travel[2])<1e-6;
  const rise=vertical?Math.max(0,travel![1]):0,x=a[0]+(offset??station.sourceMount?.x??1.2),z=original.weight[2];
  const weight:VillageVec3=[x,original.weight[1],z],beamY=original.beam.centre[1]+rise,top=beamY-.05;
  if(vertical||original.guide.kind==='grounded'){
    const bottom=ground(x,z);if(bottom===undefined||weight[1]-stroke-.25<=bottom)throw Error('Cinematic weight has no clear grounded stroke');
    return{weight,guide:{kind:'grounded',x,z,bottom,top},beam:{centre:[(a[0]-.15+x+.15)/2,beamY,z],size:[x-a[0]+.3,.1,original.beam.size[2]]}};
  }
  const span=travel?Math.hypot(travel[0],travel[2]):0;
  const postX='axis'in m&&Math.abs(m.axis[1])>.99?a[0]+2.2:a[0]-(span>0?Math.min(2.5,Math.max(.95,span*.16)):.15);
  const west=Math.min(a[0]-.15,postX-.06),east=Math.max(x+.15,postX+.06),bottom=ground(postX,z);
  if(bottom===undefined||bottom>=top)throw Error('Cinematic source mast has no ground');
  return{weight,guide:{...original.guide,centre:[x,original.guide.centre[1],z]},
    beam:{centre:[(west+east)/2,beamY,z],size:[east-west,.1,original.beam.size[2]]},
    post:{centre:[postX,(bottom+top)/2,z],size:[.12,top-bottom,.12]}};
}

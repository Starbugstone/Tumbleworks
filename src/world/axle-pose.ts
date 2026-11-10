// Mill111 selected axle implementation. Opt-in dispatch, no allocation and one ease only.
import type {Matrix4} from 'three';
import type {AxleCarrySpec} from './axle-types';
import type {VillageVec3} from './village-plan';
export function axlePose(m:{radius:number;angle:number;deckPitch?:number;axleCarry:AxleCarrySpec},anchor:VillageVec3,q:number,target:Matrix4){const spec=m.axleCarry,entry=m.deckPitch??0,w=spec.tilt.window,u=q<=m.angle-w?0:q>=m.angle?1:(q-m.angle+w)/w,beta=(spec.tilt.exitPitch-entry)*u*u*(3-2*u),phi=entry+beta,c=Math.cos(phi),s=Math.sin(phi),px=spec.pin[0],py=spec.pin[1],ox=anchor[0]+Math.cos(entry)*px-Math.sin(entry)*py,oy=anchor[1]+Math.sin(entry)*px+Math.cos(entry)*py+m.radius;target.set(c,-s,0,ox+m.radius*Math.sin(q)-c*px+s*py,s,c,0,oy-m.radius*Math.cos(q)-s*px-c*py,0,0,1,anchor[2],0,0,0,1);return target;}

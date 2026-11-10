import {reflected} from './axle-solid';
import { captiveFrameParts, captiveLeafParts, captiveLeadingSleeveGeometry } from './captive-leaf-parts';
import * as THREE from 'three';
import { openFollowerGeometry } from './open-lock-parts';
import type {VillageProfile} from '../world/village-plan';
export type RetainedLayout='keyed-split'|'keyed-prismatic'|'rigid-gate';
export interface RetainerPart {readonly id:string;readonly body:'head-frame'|'capture-head'|'fork';readonly group:'frame'|'head'|'fork';readonly geometry:THREE.BufferGeometry;readonly color:number}
/** Shared actual solids. Ownership is a disjoint mass inventory, not a mesh name. */
export function retainerParts(profile:VillageProfile,layout:RetainedLayout,direction=1,side=-1):readonly RetainerPart[]{
 if(layout==='keyed-prismatic'){
  if(!['terracotta','plank','timber'].includes(profile)||direction!==1||side!==-1)throw new Error('Captive leaf supports only explicit planar +x/rear-side assemblies');
  const old=retainerParts(profile,'keyed-split',direction,side),kept=old.filter(p=>p.body==='fork');
  const sleeve:RetainerPart=Object.freeze({id:'leading-sleeve',body:'capture-head',group:'head',geometry:captiveLeadingSleeveGeometry(),color:0x657578});
  old.filter(p=>!kept.includes(p)).forEach(p=>p.geometry.dispose());
  return Object.freeze([...captiveFrameParts(),sleeve,...captiveLeafParts(),...kept.filter(p=>p.body==='fork')]);
 }
 const keyed=layout==='keyed-split',parts:RetainerPart[]=[];
 const add=(id:string,body:RetainerPart['body'],geometry:THREE.BufferGeometry,color=0x657578)=>parts.push(Object.freeze({id,body,group:body==='capture-head'&&keyed?'head' as const:'fork' as const,geometry,color}));
 const box=(id:string,body:RetainerPart['body'],p:readonly number[],size:readonly number[],color=0x657578)=>add(id,body,new THREE.BoxGeometry(size[0],size[1],size[2]).translate(p[0]!,p[1]!,p[2]!),color);
 if(keyed){add('stator','capture-head',captureStator());add('key-pin','capture-head',new THREE.CylinderGeometry(.012,.012,.205,8).rotateX(Math.PI/2).translate(0,0,-.7775));box('slider','capture-head',[0,0,-.9],[.07,.07,.04]);}
 if(profile==='terracotta'||profile==='plank'||profile==='timber'){
 for(const [index,x] of [0,-.68*direction].entries()){
 add(index===0?'leading-sleeve':'trailing-sleeve',index===0?'capture-head':'fork',new THREE.CylinderGeometry(.04,.04,.56,16).rotateX(Math.PI/2).translate(x,0,0));
 const path=new THREE.CatmullRomCurve3([new THREE.Vector3(x,0,side*.26),new THREE.Vector3(x-.22*direction,.22,side*.28),new THREE.Vector3(x-.24*direction,.24,side*.54),new THREE.Vector3(x,0,side*.7)]);
 const tube=new THREE.TubeGeometry(path,15,.025,6,false);
 if(keyed&&index===0){const vertices=tube.getAttribute('position');for(let ring=0;ring<=15;ring++){const front=[1,.65,.2][ring]??0,back=[1,.65,.2][15-ring]??0,rearward=[1,1,1,.8,.5,.2][ring]??0;for(let j=0;j<=6;j++){const i=ring*7+j;vertices.setXYZ(i,vertices.getX(i)-.04*(front+back),vertices.getY(i),vertices.getZ(i)-.1*rearward);}}tube.computeVertexNormals();const indices=Array.from(tube.index!.array);for(let j=1;j<5;j++)indices.push(0,j+1,j);tube.setIndex(indices);}
 add(index===0?'leading-return':'trailing-return','fork',tube);
 }
 box('tie','fork',[-.34*direction-(keyed?.0125:0),0,side*.7],[keyed?.655:.68,.05,.05],0xb5925a);
 add('journal','fork',keyed?captureJournal(.03,-.875,-.66):new THREE.CylinderGeometry(.02,.02,.225,8).rotateX(Math.PI/2).translate(0,0,side*.8125));
 if(keyed&&direction===1&&side===-1)add('open-follower','fork',openFollowerGeometry());
 }else{
 for(const [index,x]of[0,-.68*direction].entries())add(index===0?'leading-sleeve':'trailing-sleeve',index===0?'capture-head':'fork',new THREE.CylinderGeometry(.04,.04,1,16).rotateX(Math.PI/2).translate(x,0,0));
 box('tie','fork',[-.34*direction,0,side*.48],[.68,.08,.08],0xb5925a);add('journal','fork',new THREE.CylinderGeometry(.02,.02,.45,8).rotateX(Math.PI/2).translate(0,0,side*.7));
 }
 return Object.freeze(parts);
}
function captureStator():THREE.BufferGeometry {
    // A single closed, constant-thickness over-rim key, in the x=y plane.
    const outline=[[-.01,-.26],[.02,-.26],[.604,-.22],[.604,-.96],[-.01,-.96],[-.01,-.92],[.01,-.92],[.01,-.94],[.584,-.94],[.584,-.24],[.02,-.275],[-.01,-.275]];
    const geometry=new THREE.ExtrudeGeometry(new THREE.Shape(outline.map(([u,z])=>new THREE.Vector2(u!,z!))),{depth:.02,steps:1,bevelEnabled:false});
    const h=Math.SQRT1_2;
    geometry.translate(0,0,-.01);geometry.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(h,h,0),new THREE.Vector3(0,0,1),new THREE.Vector3(h,-h,0)));
    return geometry;
  }
function captureJournal(radius:number,back:number,front:number):THREE.BufferGeometry {
    const positions:number[]=[],indices:number[]=[];
    for(const z of [back,front])for(const r of [.0145,radius])for(let i=0;i<8;i++){
      const angle=2*Math.PI*i/8;positions.push(r*Math.cos(angle),r*Math.sin(angle),z);
    }
    for(let i=0;i<8;i++){
      const j=(i+1)%8;
      for(const [a,b,c,d] of [[i,j,16+j,16+i],[8+j,8+i,24+i,24+j],[j,i,8+i,8+j],[16+i,16+j,24+j,24+i]])indices.push(a!,c!,b!,a!,d!,c!);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
  }

/** Additive axle-only selection. Legacy retainerParts and side−1 operators remain literal. */
export function keyedHeadParts(profile:VillageProfile,side:1|-1){const all=retainerParts(profile,'keyed-split'),wanted=['stator','key-pin','slider','leading-sleeve'];try{return wanted.map(id=>{const p=all.find(p=>p.id===id&&p.body==='capture-head');if(!p)throw new Error('Missing exact head owner '+id);return{...p,geometry:side===1?reflected(p.geometry):p.geometry.clone()};});}finally{all.forEach(p=>p.geometry.dispose());}}

import{CAPTIVE_SLOT,captiveTop}from'./captive-slot-profile';
import * as THREE from 'three';
import type { RetainerPart } from './retainer-parts';
/** Selected nominal ideal revolute joint. The brake retains its ORIGINAL lever. */
export const JOURNAL_SHOE_LEVER = .012;
export const CAPTIVE_BORE_RADIUS = .0145;
export const CAPTIVE_CONTACT_RADIUS = CAPTIVE_BORE_RADIUS * Math.cos(Math.PI / 8);
export type CaptiveTrim=
 {readonly kind:'coplanar';readonly coveredBy:string;readonly normal:readonly[number,number,number];readonly plane:number}|
 {readonly kind:'enclosed-cap';readonly part:'lift-arm';readonly cap:'start'|'end';readonly coveredBy:'leading-sleeve'|'leaf-shoe'};
export const CAPTIVE_TRIMS:Readonly<Record<string,readonly CaptiveTrim[]>>=Object.freeze({
 'key-pin':[{kind:'coplanar',coveredBy:'slider',normal:[0,0,1],plane:-.88}],
 'slider':[{kind:'coplanar',coveredBy:'leaf-guide',normal:[0,0,1],plane:-.92}],
 'lift-arm':[{kind:'enclosed-cap',part:'lift-arm',cap:'start',coveredBy:'leading-sleeve'},{kind:'enclosed-cap',part:'lift-arm',cap:'end',coveredBy:'leaf-shoe'}],
});
export function captiveFrameParts():readonly RetainerPart[] {
 const part=(id:string,geometry:THREE.BufferGeometry):RetainerPart=>Object.freeze({id,body:'head-frame',group:'frame',geometry,color:0x657578});
 return [part('slider',captiveWedgeSliderGeometry()),
  part('key-pin',captivePinGeometry()),part('leaf-guide',captiveLeafGuideGeometry())];
}
export function captiveLeafParts():readonly RetainerPart[] {
 const part=(id:string,geometry:THREE.BufferGeometry):RetainerPart=>Object.freeze({id,body:'capture-head',group:'head',geometry,color:0x657578});
 return [part('lift-arm',captiveLiftArmGeometry()),part('leaf-shoe',new THREE.BoxGeometry(.04,.04,.04).translate(0,0,-.95))];
}
export function captivePinGeometry():THREE.BufferGeometry {
 const r=CAPTIVE_CONTACT_RADIUS,positions:number[]=[],indices:number[]=[];
 if(!(JOURNAL_SHOE_LEVER<=r))throw new Error('Original journal lever exceeds nominal contact radius');
 for(const z of[-.88,-.675])for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;positions.push(r*Math.cos(a),r*Math.sin(a),z);}
 for(let i=0;i<8;i++){const j=(i+1)%8;indices.push(i,j,8+i,j,8+j,8+i);}
 for(let i=1;i<7;i++)indices.push(0,i+1,i,8,8+i,8+i+1);
 const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function captiveLeafGuideGeometry():THREE.BufferGeometry {
 const section=[[-.035,-.985],[.035,-.985],[.035,-.968],[.02,-.968],[.02,-.975],[-.02,-.975],[-.02,-.935],[.02,-.935],[.02,-.942],[.035,-.942],[.035,-.925],[-.035,-.925]];
 const g=new THREE.ExtrudeGeometry(new THREE.Shape(section.map(([x,z])=>new THREE.Vector2(x!,z!))),{depth:.66,steps:1,bevelEnabled:false});
 const p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i),p.getZ(i)-.035,p.getY(i));
 const indices:number[]=[];for(let i=0;i<p.count;i+=3)indices.push(i,i+2,i+1);g.setIndex(indices);g.computeVertexNormals();return g.translate(0,0,.005);
}
export function captiveLiftArmGeometry():THREE.BufferGeometry {
 const outline=[[.02,-.26],[.604,-.22],[.604,-.96],[-.01,-.96],[-.01,-.94],[.584,-.94],[.584,-.24],[.02,-.275]];
 const g=new THREE.ExtrudeGeometry(new THREE.Shape(outline.map(([u,z])=>new THREE.Vector2(u!,z!))),{depth:.02,steps:1,bevelEnabled:false});
 const h=Math.SQRT1_2;g.translate(0,0,-.01);g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(h,h,0),new THREE.Vector3(0,0,1),new THREE.Vector3(h,-h,0)));return g;
}

export function captiveWedgeSliderGeometry():THREE.BufferGeometry {
 const c=CAPTIVE_SLOT,positions:number[]=[],points=[-c.halfX,c.halfX].flatMap(x=>[[x,c.floor,c.back],[x,c.floor,c.front],[x,captiveTop(c.front),c.front],[x,captiveTop(c.back),c.back]]);
 const centre=new THREE.Vector3();points.forEach(p=>centre.add(new THREE.Vector3(...p as[number,number,number])));centre.multiplyScalar(1/8);
 const emit=(a:number,b:number,d:number)=>{const p=new THREE.Vector3(...points[a]as[number,number,number]),q=new THREE.Vector3(...points[b]as[number,number,number]),r=new THREE.Vector3(...points[d]as[number,number,number]);if(q.clone().sub(p).cross(r.clone().sub(p)).dot(p.clone().add(q).add(r).multiplyScalar(1/3).sub(centre))<0)[b,d]=[d,b];for(const i of[a,b,d])positions.push(...points[i]!);};
 for(const[a,b,d,e]of[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]){emit(a!,b!,d!);emit(a!,d!,e!);}
 const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}

/** Closed OPT-IN sleeve. Three's declared duplicated ring endpoint is copied
 * literally from its first endpoint, on torso AND caps. No verifier weld. */
export function captiveLeadingSleeveGeometry():THREE.CylinderGeometry {
 const g=new THREE.CylinderGeometry(.04,.04,.56,16).rotateX(Math.PI/2),p=g.getAttribute('position'),n=g.getAttribute('normal');
 if(p.count!==100)throw new Error('Selected CylinderGeometry ring layout changed');
 for(const[first,last]of[[0,16],[17,33],[50,66],[83,99]]){p.setXYZ(last!,p.getX(first!),p.getY(first!),p.getZ(first!));n.setXYZ(last!,n.getX(first!),n.getY(first!),n.getZ(first!));}
 return g;
}

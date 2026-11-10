import{Matrix4,Mesh,Ray,Triangle,Vector3,type BufferGeometry}from'three';
import{villageFloorDepth}from'../view/machine-primitives';
import type{VillageProfile}from'./village-plan';
export type CarrierWeldId='corner'|'open-guide'|'bracket'|'bearing'|'deck'|'deck-link'|'yoke'|'beam'|'caliper';
export interface CarrierWeldPart{readonly mesh:Mesh;readonly closed:BufferGeometry}
const certificates=new WeakSet<object>();
export function carrierWeldsCertified(owner:object):boolean{return certificates.has(owner);}
const faces=(g:BufferGeometry,m:Matrix4)=>{const p=g.getAttribute('position'),ix=g.index,result:Triangle[]=[];for(let i=0;i<(ix?.count??p.count);i+=3)result.push(new Triangle(...[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(m))as[Vector3,Vector3,Vector3]));return result;};
/** Finite actual SAME-CARRIER weld patches, no crossing/exposure exemption.
 * The sole missing rendered face permitted here is the already-certified
 * corner cheek bottom. All other source/render buffers must remain exact. */
export function certifyCarrierWelds(owner:object,parts:ReadonlyMap<CarrierWeldId,CarrierWeldPart>,last:number,profile:VillageProfile,vertical:boolean):void{
 const required:CarrierWeldId[]=['corner','open-guide','bracket','bearing','deck','deck-link','yoke','beam','caliper'];const found=required.map(id=>{const p=parts.get(id);if(!p||!(p.mesh instanceof Mesh))throw new Error(`Missing actual carrier weld part ${id}`);return p;});
 const parent=found[0]!.mesh.parent;if(!parent||found.some(p=>p.mesh.parent!==parent))throw new Error('Carrier weld parts do not share the actual permanent carrier');
 const surface=new Map<CarrierWeldId,Triangle[]>();let magnitude=1;
 for(const id of required){const p=parts.get(id)!;p.mesh.updateMatrix();if(!p.mesh.matrix.equals(new Matrix4()))throw new Error('Unexpected carrier part-local transform');const a=p.closed.getAttribute('position'),b=p.mesh.geometry.getAttribute('position');if(a.array.length!==b.array.length||Array.from(a.array).some((v,i)=>!Object.is(v,b.array[i])))throw new Error('Carrier weld source/render positions differ');
  const source=Array.from(p.closed.index?.array??Array.from({length:a.count},(_,i)=>i)),render=Array.from(p.mesh.geometry.index?.array??Array.from({length:b.count},(_,i)=>i));
  if(id==='corner'){const expected:number[]=[];for(let i=0;i<source.length;i+=3){const ids=source.slice(i,i+3);if(ids.every(j=>Math.abs(a.getY(j)+.035)<8*2**-24))continue;expected.push(...ids);}if(expected.length!==source.length-6||render.length!==expected.length||render.some((v,i)=>v!==expected[i]))throw new Error('Corner render lost an undeclared face');}
  else if(render.length!==source.length||render.some((v,i)=>v!==source[i]))throw new Error('A carrier weld part was secretly trimmed');
  surface.set(id,faces(p.closed,p.mesh.matrix));for(const value of a.array)magnitude=Math.max(magnitude,Math.abs(value));
 }
 const bound=8*2**-24*magnitude,hit=new Vector3(),normal=new Vector3();
 const face=(id:CarrierWeldId,point:Vector3,out:Vector3)=>{const ray=new Ray(point.clone().addScaledVector(out,-.005),out);let distance=Infinity,dot=0;for(const t of surface.get(id)!)if(ray.intersectTriangle(t.a,t.b,t.c,false,hit)){const d=hit.distanceTo(ray.origin);if(d<distance){distance=d;dot=t.getNormal(normal).dot(out);}}if(Math.abs(distance-.005)>bound||dot<.99999)throw new Error(`Actual finite weld face missing: ${id}`);};
 const pair=(a:CarrierWeldId,b:CarrierWeldId,point:Vector3,out:Vector3)=>{face(a,point,out);face(b,point,out.clone().negate());};
 const depth=Math.max(.42,.3+villageFloorDepth(profile)+.02),underside=.3+villageFloorDepth(profile);
 for(const dx of[-.007,.007])for(const dz of[-.015,.015])pair('corner','open-guide',new Vector3(last+.04+dx*.5,-.035,-.9+dz),new Vector3(0,-1,0));
 for(const dx of[-.007,.007])for(const dz of[-.015,.015])pair('open-guide','bracket',new Vector3(last+.035+dx,-.055,-.9+dz),new Vector3(0,-1,0));
 for(const dx of[-.015,.015])for(const dz of[-.007,.007])pair('bracket','bearing',new Vector3(last+.045+dx,-depth+.02,-.89+dz),new Vector3(0,-1,0));
 for(const dx of[-.015,.015])for(const z of[-.3,-.1])pair('bearing','deck',new Vector3(last+.045+dx,-underside,z),new Vector3(0,1,0));
 for(const x of[-.025,.025])for(const z of[-.2,.2])pair('deck','deck-link',new Vector3(x,-underside,z),new Vector3(0,-1,0));
 for(const x of[-.025,.025])for(const y of[-underside-.06,-underside-.02])pair('deck-link','yoke',new Vector3(x,y,-.6),new Vector3(0,0,-1));
 for(const x of[-.025,.025])for(const z of[-.66,-.62])pair('yoke','beam',new Vector3(x,1.65,z),new Vector3(0,1,0));
 if(vertical)for(const x of[-.04,.04])for(const y of[1.675,1.725])pair('beam','caliper',new Vector3(x,y,-1.07),new Vector3(0,0,-1));
 else for(const x of[-.05,.05])for(const z of[-.70,-.58])pair('beam','caliper',new Vector3(x,1.75,z),new Vector3(0,1,0));
 certificates.add(owner);
}

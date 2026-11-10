import{VILLAGE_RADIUS}from'../world/village-plan';
import{carrierEdges,villageFloorDepth}from'./machine-primitives';
// Geometry in station-local rest coordinates; no scene names certify it.
import{BufferGeometry,Float32BufferAttribute,ShapeUtils,Vector2,BoxGeometry}from'three';
import type{VillageStation}from'../world/village-plan';
import type{GravityRockerSpec}from'../world/gravity-rocker-types';
export type HingeId='beam-boss'|'hinge-pin'|'hinge-post-neg'|'hinge-post-pos'|'home-seat'|'dock-seat';
export interface HingePart{readonly id:HingeId;readonly body:'carrier'|'fixed';readonly geometry:BufferGeometry;readonly color:number}
export interface HingeParts{readonly parts:readonly HingePart[];readonly axis:readonly[number,number,number];readonly angle:number;readonly seats:readonly {readonly id:'home-seat'|'dock-seat';readonly angle:number;readonly lever:number;readonly line:readonly[readonly[number,number,number],readonly[number,number,number]]}[];readonly expectedTriangles:118;readonly massModel:'authored-effective-TOTAL-not-density';readonly centralInertia:number}
function geometry(p:number[],ix:number[]):BufferGeometry{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g;}
function hex(radius:number,phase:number,z0:number,z1:number,x:number,y:number):BufferGeometry{const p:number[]=[],ix:number[]=[];for(const z of[z0,z1])for(let i=0;i<6;i++){const a=phase+i*Math.PI/3;p.push(x+radius*Math.cos(a),y+radius*Math.sin(a),z);}for(let i=0;i<6;i++){const j=(i+1)%6;ix.push(i,j,6+i,j,6+j,6+i);}return geometry(p,ix);}
function beam(pivot:readonly number[],top:number,entry:number,exit:number):BufferGeometry{
 const x0=entry-pivot[0]!,x1=exit-pivot[0]!,outer=[[x0,top],[x0,-.02],[-.07794,-.02],[-.07794,-.045],[0,-.09],[.07794,-.045],[.07794,-.02],[x1,-.02],[x1,top]].map(v=>new Vector2(v[0],v[1])),hole=Array.from({length:6},(_,i)=>{const a=Math.PI/2-i*Math.PI/3;return new Vector2(.05/Math.cos(Math.PI/6)*Math.cos(a),.05/Math.cos(Math.PI/6)*Math.sin(a));}),points=[...outer,...hole],N=points.length,p:number[]=[],ix:number[]=[];
 for(const z of[-.275,.275])for(const v of points)p.push(v.x+pivot[0]!,v.y+pivot[1]!,z);
 for(const t of ShapeUtils.triangulateShape(outer,[hole])){const[a,b,c]=t as[number,number,number],u=points[a]!,v=points[b]!,w=points[c]!,positive=(v.x-u.x)*(w.y-u.y)-(v.y-u.y)*(w.x-u.x)>0;ix.push(...(positive?[a,c,b,N+a,N+b,N+c]:[a,b,c,N+a,N+c,N+b]));}
 // Deliberately omit ONLY the final outer edge, entirely under the deck underside.
 for(let i=0;i<outer.length-1;i++){const j=i+1;ix.push(i,j,N+i,j,N+j,N+i);}
 for(let i=0;i<6;i++){const a=outer.length+i,b=outer.length+(i+1)%6;ix.push(a,b,N+a,b,N+b,N+a);}
 return geometry(p,ix);
}
export function gravityHingeParts(station:VillageStation,spec:GravityRockerSpec,ground:(x:number,z:number)=>number|undefined):HingeParts{
 const m=station.mechanism;if(m.kind!=='tipping'||m.axis.some((v,i)=>v!==[0,0,1][i])||m.localContact||m.dockingLift||m.deckPitch||station.retention||station.supports||station.terminalCapture||station.hinge!=='outboard-journal')throw new Error('Rocker parts require the explicit planar outboard journal opt-in');
 const p=m.pivot,parts:HingePart[]=[],add=(id:HingeId,body:HingePart['body'],g:BufferGeometry,color=0x657578)=>parts.push({id,body,geometry:g,color});
 try{const [entry,exit]=carrierEdges(m),top=-(VILLAGE_RADIUS+villageFloorDepth('terracotta'))-p[1];add('beam-boss','carrier',beam(p,top,entry,exit),0x9d784f);
 add('hinge-pin','fixed',hex(.05,Math.PI/2+m.angle/2,-.61,.61,p[0],p[1]));
 const seats:HingeParts['seats'][number][]=[];
 for(const[id,angle,lever]of[['home-seat',0,-spec.homeSeat.lever],['dock-seat',m.angle,spec.dockSeat.lever]]as const){const c=Math.cos(angle),s=Math.sin(angle),x=p[0]+lever*c+.05*s,y=p[1]+lever*s-.05*c;add(id,'fixed',hex(.03,Math.PI/2+angle,-.61,.61,x,y));const X=p[0]+lever*c+.02*s,Y=p[1]+lever*s-.02*c;seats.push({id,angle,lever,line:[[X,Y,-.275],[X,Y,.275]]});}
 for(const side of[-1,1]){const z=side*.58,heights=[-.15,.15].flatMap(dx=>[-.06,.06].map(dz=>ground(station.anchor[0]+p[0]+dx,station.anchor[2]+z+dz)));if(heights.some(y=>y===undefined)||heights.some(y=>y!==heights[0]))throw new Error('Rocker post needs its complete finite flat land rectangle');const bottom=heights[0]!-station.anchor[1],top=p[1]+.09;if(!(top>bottom))throw new Error('Rocker post has no upright height');const g=new BoxGeometry(.30,top-bottom,.12).translate(p[0],(top+bottom)/2,z),v=g.getAttribute('position');for(let i=0;i<v.count;i++)if(v.getY(i)<(top+bottom)/2)v.setY(i,Math.fround(bottom));g.computeVertexNormals();add(side<0?'hinge-post-neg':'hinge-post-pos','fixed',g);}
 return{parts,axis:p,angle:m.angle,seats,expectedTriangles:118,massModel:'authored-effective-TOTAL-not-density',centralInertia:spec.centralInertia};}catch(error){parts.forEach(p=>p.geometry.dispose());throw error;}
}

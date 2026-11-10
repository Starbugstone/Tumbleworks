import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Matrix4, Shape, Path, ExtrudeGeometry, Quaternion, Vector3 } from 'three';
import type { VillageStation } from '../world/village-plan';
import type { PendulumDrive } from '../world/pendulum-types';
import { solidMoments } from '../world/village-inventory';
export interface PendulumPart {readonly id:string;readonly body:'hammer'|'fixed';readonly geometry:BufferGeometry;readonly color:number}
export interface PendulumParts {
 readonly parts:readonly PendulumPart[];readonly bar:BufferGeometry;readonly mass:number;readonly axleInertia:number;
 readonly centre:readonly[number,number,number];readonly bearingRadius:number;
 readonly axialProducts:readonly[number,number];
 readonly inventory:readonly Readonly<{id:string;volume:number;mass:number;centre:readonly[number,number,number];axleInertia:number}>[];
 readonly joints:readonly Readonly<{id:string;parts:readonly[string,string];model:'ideal-revolute'|'finite-weld'|'stop-contact';axial?:readonly[number,number]}>[];
 readonly holdSite:'bearing-static';
}
/** Products of inertia required by the radial bearing wrench. Scalar Izz
 * alone loses the real axial offset of this composite hammer. */
function axialProducts(g:BufferGeometry):readonly[number,number]{
 const p=g.getAttribute('position'),ix=g.index,a=new Vector3(),b=new Vector3(),c=new Vector3(),cross=new Vector3();let volume=0,xz=0,yz=0;
 for(let i=0;i<(ix?.count??p.count);i+=3){a.fromBufferAttribute(p,ix?ix.getX(i):i);b.fromBufferAttribute(p,ix?ix.getX(i+1):i+1);c.fromBufferAttribute(p,ix?ix.getX(i+2):i+2);const v=a.dot(cross.crossVectors(b,c))/6;volume+=v;
  xz+=v*((a.x+b.x+c.x)*(a.z+b.z+c.z)+a.x*a.z+b.x*b.z+c.x*c.z)/20;
  yz+=v*((a.y+b.y+c.y)*(a.z+b.z+c.z)+a.y*a.z+b.y*b.z+c.y*c.z)/20;
 }return[xz/volume,yz/volume];
}
function ring(inner:number,outer:number,length:number,z:number):BufferGeometry{
 const shape=new Shape(),hole=new Path(),segments=16;
 for(let i=0;i<segments;i++){const a=2*Math.PI*i/segments;const x=outer*Math.cos(a),y=outer*Math.sin(a);i?shape.lineTo(x,y):shape.moveTo(x,y);}
 shape.closePath();
 for(let i=segments-1;i>=0;i--){const a=2*Math.PI*i/segments;const x=inner*Math.cos(a),y=inner*Math.sin(a);i===segments-1?hole.moveTo(x,y):hole.lineTo(x,y);}
 hole.closePath();shape.holes.push(hole);
 return new ExtrudeGeometry(shape,{depth:length,steps:1,bevelEnabled:false}).translate(0,0,z);
}
/** Closed polygonal prism. Left rest facet is constructed at one common packed x;
 * rotating sphere contact reads these actual vertices, never a nominal circle. */
export function pendulumBar(d:PendulumDrive):BufferGeometry{
 const n=d.bar.facets,r=d.bar.radius,L=d.bar.arm,p:number[]=[],index:number[]=[];
 for(const z of [-d.bar.length/2,d.bar.length/2])for(let i=0;i<n;i++){
  const a=(i+.5)*2*Math.PI/n,x=i===n/2-1||i===n/2?-r*Math.cos(Math.PI/n):r*Math.cos(a);
  p.push(x,-L+r*Math.sin(a),z);
 }
 for(let i=0;i<n;i++){const j=(i+1)%n;index.push(i,j,n+i,j,n+j,n+i);}
 for(let i=1;i<n-1;i++)index.push(0,i+1,i,n,n+i,n+i+1);
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(index);g.computeVertexNormals();return g;
}
/** Axle-local closed inventory parts; fixed pieces are also axle-local. Renderer
 * composes the same axle frame. Supports use current terrain, never fake soil. */
export function pendulumParts(station:VillageStation,d:PendulumDrive,ground:(x:number,z:number)=>number|undefined):PendulumParts{
 const parts:PendulumPart[]=[],color=d.dress==='mill-paddle'?station.color:0x657578;
 const add=(id:string,body:PendulumPart['body'],geometry:BufferGeometry,tint=color)=>parts.push({id,body,geometry,color:tint});
 const box=(id:string,body:PendulumPart['body'],x:number,y:number,z:number,a:number,b:number,c:number)=>add(id,body,new BoxGeometry(a,b,c).translate(x,y,z));
 const bar=pendulumBar(d);add('striking-bar','hammer',bar,station.color);
 box('hammer-arm','hammer',0,-d.bar.arm/2,-.36,.04,d.bar.arm-.08,.06);
 box('bar-return','hammer',0,-d.bar.arm+.04,-.31,.04,.08,.14);
 add('hammer-hub','hammer',ring(.025/Math.cos(Math.PI/16),.055,.12,-.42));
 add('fixed-axle','fixed',new CylinderGeometry(.025,.025,1.4,16).rotateX(Math.PI/2));
 for(const side of [-1,1]){
  const z=side*.65,wx=d.axle.origin[0],wz=d.axle.origin[2]+z;
  const heights=[-.07,.07].flatMap(x=>[-.07,.07].map(dz=>ground(wx+x,wz+dz)));
  if(heights.some(h=>h===undefined))throw new Error('Pendulum frame footing crosses void');
  const bottom=Math.min(...heights as number[])-d.axle.origin[1];
  if(!(bottom<-.12))throw new Error('Pendulum frame has no upright ground height');
  const top=.1,post=new BoxGeometry(.14,top-bottom,.14).translate(0,(top+bottom)/2,z),p=post.getAttribute('position');
  for(let i=0;i<p.count;i++)if(p.getY(i)<(top+bottom)/2){const h=ground(d.axle.origin[0]+p.getX(i),d.axle.origin[2]+p.getZ(i));if(h===undefined)throw new Error('Pendulum foot corner over void');p.setY(i,h-d.axle.origin[1]);}
  post.computeVertexNormals();add(`frame-post-${side}`,'fixed',post);
 }
 box('frame-cap','fixed',0,.18,0,.18,.16,1.44);
 // The actual bar support point against the stop plate uses the packed profile.
 const cq=Math.cos(d.stopAngle),sq=Math.sin(d.stopAngle),vertices=bar.getAttribute('position');let support=-Infinity;
 for(let i=0;i<vertices.count;i++)support=Math.max(support,vertices.getX(i));
 const bx=d.bar.arm*sq,by=-d.bar.arm*cq;
 add('bell-stop','fixed',new BoxGeometry(.08,.18,.22).translate(support+.04,-d.bar.arm,-.22).rotateZ(d.stopAngle),0xb5925a);
 // Closed stop strut and its own real ground post. No operative pawl is
 // rendered: the approved bearing static cone must hold, or compilation fails.
 const plateX=bx+(support+.04)*cq,plateY=by+(support+.04)*sq;
 const footX=d.axle.origin[0]+plateX,footZ=d.axle.origin[2]-.62;
 const h=ground(footX,footZ);if(h===undefined)throw new Error('Pendulum bell stop footing over void');
 const top=plateY-.32,bottom=h-d.axle.origin[1];if(!(top>bottom))throw new Error('Bell support intersects ground');
 box('bell-foot','fixed',plateX,(top+bottom)/2,-.62,.10,top-bottom,.10);
 const end=new Vector3(plateX+.06*sq,plateY-.06*cq,-.31),start=new Vector3(plateX,top,-.62);
 const direction=end.clone().sub(start),strut=new CylinderGeometry(.04,.04,direction.length(),8);
 strut.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.clone().normalize()));
 strut.translate(...start.clone().add(end).multiplyScalar(.5).toArray());add('bell-return','fixed',strut);
 const measured=parts.filter(p=>p.body==='hammer').map(p=>({id:p.id,...solidMoments(p.geometry),products:axialProducts(p.geometry)}));
 const volume=measured.reduce((a,p)=>a+p.volume,0),weights=measured.map(p=>({...p,mass:d.mass*p.volume/volume}));
 const axleInertia=weights.reduce((sum,p)=>sum+p.mass*p.axlePerMass,0);
 const centre=[0,1,2].map(i=>weights.reduce((sum,p)=>sum+p.mass*p.centre[i]!,0)/d.mass)as[number,number,number];
 if(!(axleInertia>d.mass*(centre[0]**2+centre[1]**2)))throw new Error('Pendulum inertia below parallel-axis minimum');
 return {parts,bar,mass:d.mass,axleInertia,centre,axialProducts:[weights.reduce((a,p)=>a+p.mass*p.products[0],0),weights.reduce((a,p)=>a+p.mass*p.products[1],0)],inventory:weights.map(p=>Object.freeze({id:p.id,volume:p.volume,mass:p.mass,centre:p.centre,axleInertia:p.mass*p.axlePerMass})),bearingRadius:.025,holdSite:'bearing-static',joints:[
  {id:'axle-bearing',parts:['fixed-axle','hammer-hub'],model:'ideal-revolute',axial:[-.42,-.3]},
  {id:'bar-weld',parts:['striking-bar','bar-return'],model:'finite-weld'},
  {id:'arm-weld',parts:['bar-return','hammer-arm'],model:'finite-weld'},
  {id:'hub-weld',parts:['hammer-arm','hammer-hub'],model:'finite-weld'},
  {id:'stop',parts:['striking-bar','bell-stop'],model:'stop-contact'},
 ]};
}
/** Only the first consumer's flat +x/up frame is accepted in this slice. */
export function pendulumFrame(d:PendulumDrive):Matrix4{
 if(d.axle.axis[0]!==0||d.axle.axis[1]!==0||d.axle.axis[2]!==1)throw new Error('Pendulum across-track axle unsupported');
 return new Matrix4().setPosition(new Vector3(...d.axle.origin));
}
export {ring as journalRingGeometry};

/** One exact same-body weld trim. The closed arm/return inventory is unchanged;
 * the return owns their common x faces, and the arm keeps the L-shaped rest. */
export function pendulumRenderGeometry(part:PendulumPart,parts:PendulumParts):BufferGeometry{
 if(part.id!=='hammer-arm')return part.geometry;
 const cover=parts.parts.find(p=>p.id==='bar-return');if(!cover||part.body!=='hammer'||cover.body!=='hammer')throw new Error('Pendulum arm trim needs its rigid return');
 const bounds=(g:BufferGeometry)=>{const p=g.getAttribute('position');return[0,1,2].map(i=>[Math.min(...Array.from({length:p.count},(_,j)=>p.getComponent(j,i))),Math.max(...Array.from({length:p.count},(_,j)=>p.getComponent(j,i)))]as const);};
 const a=bounds(part.geometry),b=bounds(cover.geometry),[xmin,xmax]=a[0]!,[ymin,ymax]=a[1]!,[zmin,zmax]=a[2]!,cutY=b[1]![1],cutZ=b[2]![0];
 if(xmin!==b[0]![0]||xmax!==b[0]![1]||b[1]![0]>ymin||!(cutY>ymin&&cutY<ymax)||!(cutZ>zmin&&cutZ<zmax)||b[2]![1]<zmax)throw new Error('Pendulum weld trim topology changed');
 const p=part.geometry.getAttribute('position'),ix=part.geometry.index,positions:number[]=[];
 for(let i=0;i<(ix?.count??p.count);i+=3){const ids=[0,1,2].map(j=>ix?ix.getX(i+j):i+j);if(ids.every(j=>p.getX(j)===xmin)||ids.every(j=>p.getX(j)===xmax))continue;for(const j of ids)positions.push(p.getX(j),p.getY(j),p.getZ(j));}
 const rectangle=(x:number,y0:number,y1:number,z0:number,z1:number,positive:boolean)=>{const v=[[x,y0,z0],[x,y1,z0],[x,y1,z1],[x,y0,z1]];for(const k of positive?[0,1,2,0,2,3]:[0,2,1,0,3,2])positions.push(...v[k]!);};
 for(const x of[xmin,xmax]){rectangle(x,ymin,cutY,zmin,cutZ,x===xmax);rectangle(x,cutY,ymax,zmin,zmax,x===xmax);}
 const render=new BufferGeometry();render.setAttribute('position',new Float32BufferAttribute(positions,3));render.computeVertexNormals();return render;
}

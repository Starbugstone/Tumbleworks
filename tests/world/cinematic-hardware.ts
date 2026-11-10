import {Box3,Mesh,Object3D,Vector3} from 'three';
import {surfaceTriangles,type SurfaceTriangle} from './surface-overlap';
import {triangleCrossing,visible} from './village-geometry';
import type {VillageMachine} from '../../src/view/village-machine';

class Grid {
  private cells=new Map<string,SurfaceTriangle[]>();
  constructor(faces:readonly SurfaceTriangle[]){for(const f of faces)this.visit(f.bounds,k=>{const rows=this.cells.get(k);if(rows)rows.push(f);else this.cells.set(k,[f]);});}
  private visit(b:Box3,fn:(key:string)=>void){for(let x=Math.floor(b.min.x/2);x<=Math.floor(b.max.x/2);x++)for(let y=Math.floor(b.min.y/2);y<=Math.floor(b.max.y/2);y++)for(let z=Math.floor(b.min.z/2);z<=Math.floor(b.max.z/2);z++)fn(`${x}/${y}/${z}`);}
  near(f:SurfaceTriangle){const rows=new Set<SurfaceTriangle>();this.visit(f.bounds,k=>{for(const r of this.cells.get(k)??[])rows.add(r);});return rows;}
}

/** Finite endpoints of a proper crossing, rather than a triangle's unrelated first vertex. */
export function crossingSegment(a:SurfaceTriangle,b:SurfaceTriangle):Vector3[]{
  const direction=a.normal.clone().cross(b.normal).normalize();
  const cuts=(f:SurfaceTriangle,other:SurfaceTriangle)=>{
    const v=[f.a,f.b,f.c],d=v.map(p=>p.clone().sub(other.a).dot(other.normal)),p:Vector3[]=[];
    for(let i=0;i<3;i++){const j=(i+1)%3;if(d[i]===0)p.push(v[i]!.clone());if(d[i]!*d[j]!<0)p.push(v[i]!.clone().lerp(v[j]!,d[i]!/(d[i]!-d[j]!)));}return p.sort((x,y)=>x.dot(direction)-y.dot(direction));
  };
  const p=cuts(a,b),q=cuts(b,a);if(p.length<2||q.length<2)return[];
  return[p[0]!.dot(direction)>q[0]!.dot(direction)?p[0]!:q[0]!,p.at(-1)!.dot(direction)<q.at(-1)!.dot(direction)?p.at(-1)!:q.at(-1)!];
}

/** Only the named axle/body connections are joints, within the actual finite shaft bounds.
 * A shaft crossing scenery, another station or a track never receives an allowance. */
export function intendedCinematicJoint(machine:VillageMachine,a:SurfaceTriangle,b:SurfaceTriangle):boolean{
  const carrier=(o:Object3D,stop:number)=>{for(let p:Object3D|null=o;p;p=p.parent)if(p.name===`village-${stop}-carrier`)return true;return false;};
  const wheel=(o:Object3D,stop:number)=>{for(let p:Object3D|null=o;p;p=p.parent)if(p.name===`village-${stop}-wheel`)return true;return false;};
  const fixed=(o:Object3D,stop:number)=>{for(let p:Object3D|null=o;p;p=p.parent)if(p.name===`village-stop-${stop}-static`)return true;return false;};
  const cylinder=(m:Mesh,r:number,h:number)=>{const p=(m.geometry as import('three').CylinderGeometry).parameters;return m.geometry.type==='CylinderGeometry'&&p.radiusTop===r&&p.radiusBottom===r&&p.height===h;};
  const finite=(m:Mesh)=>{const bounds=new Box3().setFromObject(m).expandByScalar(.002),points=crossingSegment(a,b);return points.length===2&&points.every(p=>bounds.containsPoint(p));};
  for(const s of machine.plan.stations){
    for(const[x,y]of[[a,b],[b,a]]as const){
      if('pivot'in s.mechanism&&fixed(x.mesh,s.stop)&&carrier(y.mesh,s.stop)&&cylinder(x.mesh,.09,machine.plan.profile==='girder'&&Math.abs(s.mechanism.axis[1])>.99?.68:.7)&&finite(x.mesh))return true;
      if('pivot'in s.mechanism&&s.mechanism.dockingLift&&fixed(x.mesh,s.stop)&&carrier(y.mesh,s.stop)&&cylinder(y.mesh,.065,s.mechanism.dockingLift+.3)&&finite(y.mesh)){
        // The lift spindle engages the fixed pivot bearing/brace at this station.
        const p=new Vector3(...s.mechanism.pivot).add(new Vector3(...s.anchor)),region=new Box3().setFromCenterAndSize(p,new Vector3(.4,2*(s.mechanism.dockingLift+.3),2.2));
        if(crossingSegment(a,b).every(v=>region.containsPoint(v)))return true;
      }
      if(s.mechanism.kind==='wheelbucket'){
        if(fixed(x.mesh,s.stop)&&wheel(y.mesh,s.stop)&&cylinder(x.mesh,.09,.5)&&finite(x.mesh))return true;
        if(carrier(x.mesh,s.stop)&&wheel(y.mesh,s.stop)&&cylinder(x.mesh,.07,.65)&&finite(x.mesh))return true;
      }
    }
  }
  return false;
}

/** Cache immutable native triangles and update only rigid transforms that actually changed. */
export class CinematicHardwareAudit {
  private fixed:SurfaceTriangle[]=[];
  private moving:SurfaceTriangle[]=[];
  private bodies=new Map<Mesh,Object3D>();
  private dynamic:{mesh:Mesh;matrix:number[];faces:{face:SurfaceTriangle;local:Vector3[]}[]}[]=[];
  private index:Grid;
  constructor(private machine:VillageMachine,root:Object3D){
    const movers=(machine as unknown as{movers:{group:Object3D}[]}).movers.map(m=>m.group);
    for(const f of surfaceTriangles(root).filter(f=>visible(f.mesh))){let body:Object3D|undefined;for(let p:Object3D|null=f.mesh;p;p=p.parent)if(movers.includes(p)){body=p;break;}if(body){this.moving.push(f);this.bodies.set(f.mesh,body);}else this.fixed.push(f);}
    for(const mesh of this.bodies.keys()){const inverse=mesh.matrixWorld.clone().invert();this.dynamic.push({mesh,matrix:[],faces:this.moving.filter(f=>f.mesh===mesh).map(face=>({face,local:[face.a,face.b,face.c].map(p=>p.clone().applyMatrix4(inverse))}))});}
    this.index=new Grid(this.fixed);
  }
  check(){
    const changed=new Set<Mesh>();
    for(const d of this.dynamic){d.mesh.updateWorldMatrix(true,false);if(d.mesh.matrixWorld.elements.every((v,i)=>v===d.matrix[i]))continue;changed.add(d.mesh);d.matrix=d.mesh.matrixWorld.toArray();for(const{face:f,local}of d.faces){f.a.copy(local[0]!).applyMatrix4(d.mesh.matrixWorld);f.b.copy(local[1]!).applyMatrix4(d.mesh.matrixWorld);f.c.copy(local[2]!).applyMatrix4(d.mesh.matrixWorld);f.normal.subVectors(f.b,f.a).cross(new Vector3().subVectors(f.c,f.a)).normalize();f.bounds.setFromPoints([f.a,f.b,f.c]);}}
    if(!changed.size)return[];
    const dynamicIndex=new Grid(this.moving),failures:{a:string;b:string;points:number[][]}[]=[];
    const inspect=(a:SurfaceTriangle,b:SurfaceTriangle)=>{if(a.mesh===b.mesh||this.bodies.get(a.mesh)===this.bodies.get(b.mesh))return;if(triangleCrossing(a,b)&&!intendedCinematicJoint(this.machine,a,b))failures.push({a:a.mesh.name,b:b.mesh.name,points:crossingSegment(a,b).map(p=>p.toArray())});};
    for(const a of this.moving)if(changed.has(a.mesh)){for(const b of this.index.near(a))inspect(a,b);for(const b of dynamicIndex.near(a))inspect(a,b);}
    return failures;
  }
}

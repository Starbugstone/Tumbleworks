import type { BufferGeometry } from 'three';
import type { BarContact } from './pendulum-types';

/** Exact convex cross-section of the actual Float32 bar. No ideal circle is used
 * for marble contact. The ideal axle joint is a separate, named support model. */
export class PendulumProfile {
 readonly xy:Float64Array;
 constructor(geometry:BufferGeometry,readonly axleX:number,readonly axleY:number,readonly radius=.3){
  const p=geometry.getAttribute('position'),unique=new Map<string,readonly[number,number]>();
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);unique.set(`${x},${y}`,[x,y]);}
  const points=[...unique.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a:readonly number[],b:readonly number[],c:readonly number[])=>(b[0]!-a[0]!)*(c[1]!-a[1]!)-(b[1]!-a[1]!)*(c[0]!-a[0]!);
  const lower:typeof points=[],upper:typeof points=[];
  for(const a of points){while(lower.length>=2&&cross(lower.at(-2)!,lower.at(-1)!,a)<=0)lower.pop();lower.push(a);}
  for(const a of [...points].reverse()){while(upper.length>=2&&cross(upper.at(-2)!,upper.at(-1)!,a)<=0)upper.pop();upper.push(a);}
  lower.pop();upper.pop();this.xy=new Float64Array([...lower,...upper].flat());
  if(this.xy.length<6||!(radius>0))throw new Error('Packed pendulum profile is not a convex solid');
 }
 /** Leftmost boundary of polygon ⊕ sphere disk on the exact flat centreline y=0.
  * Edge offsets and rounded vertex arcs meet continuously; feature changes are
  * exposed to the event solver. Caller owns target; query allocates nothing. */
 sample(q:number,target:BarContact):boolean{
  const c=Math.cos(q),s=Math.sin(q),n=this.xy.length/2,R=this.radius;
  let best=Infinity,found=false;
  for(let i=0;i<n;i++){
   const j=(i+1)%n,x0=this.xy[2*i]!,y0=this.xy[2*i+1]!,x1=this.xy[2*j]!,y1=this.xy[2*j+1]!;
   const ax=this.axleX+c*x0-s*y0,ay=this.axleY+s*x0+c*y0;
   const bx=this.axleX+c*x1-s*y1,by=this.axleY+s*x1+c*y1;
   const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),nx=dy/len,ny=-dx/len;
   if(nx<0){
    const t=(-ay-R*ny)/dy;
    if(dy!==0&&t>=0&&t<=1){
     const x=ax+t*dx+R*nx;
     if(x<best){
      const n0x=(y1-y0)/len,n0y=-(x1-x0)/len,K=R+n0x*x0+n0y*y0,E=K+ny*this.axleY;
      const first=this.axleY+E*ny/(nx*nx);
      const second=this.axleY*ny/nx+E/nx+2*E*ny*ny/(nx*nx*nx);
      best=x;found=true;target.feature=i;target.kind='edge';target.x=x;target.first=first;target.second=second;
      target.nx=nx;target.ny=ny;target.J=nx*first;target.margin=Math.min(t,1-t);
     }
    }
   }
   if(Math.abs(ay)<R){
    const d=Math.sqrt(R*R-ay*ay),x=ax-d,cnx=-d/R,cny=-ay/R;
    const k=(i+n-1)%n,px0=this.xy[2*k]!,py0=this.xy[2*k+1]!;
    const px=this.axleX+c*px0-s*py0,py=this.axleY+s*px0+c*py0;
    const before=cnx*(px-ax)+cny*(py-ay),after=cnx*dx+cny*dy;
    if(before<=0&&after<=0&&x<best){
     const vx=-(ay-this.axleY),vy=ax-this.axleX,vxx=-(ax-this.axleX),vyy=-(ay-this.axleY);
     const first=vx+ay*vy/d,second=vxx+(vy*vy+ay*vyy)/d+ay*ay*vy*vy/(d*d*d);
     best=x;found=true;target.feature=i+n;target.kind='vertex';target.x=x;target.first=first;target.second=second;
     target.nx=cnx;target.ny=cny;target.J=cnx*first;target.margin=Math.min(-before,-after);
    }
   }
  }
  return found;
 }
 /** Explicit feature formula at a shared boundary. Extension is ONLY for a
  * certified cell's one-sided limit, never for choosing a foreign surface. */
 sampleFeature(feature:number,q:number,target:BarContact,oneSided=false):boolean{
  const n=this.xy.length/2,i=feature%n,j=(i+1)%n,R=this.radius,c=Math.cos(q),s=Math.sin(q),x0=this.xy[2*i]!,y0=this.xy[2*i+1]!,x1=this.xy[2*j]!,y1=this.xy[2*j+1]!;
  const ax=this.axleX+c*x0-s*y0,ay=this.axleY+s*x0+c*y0,bx=this.axleX+c*x1-s*y1,by=this.axleY+s*x1+c*y1,dx=bx-ax,dy=by-ay;
  if(feature<n){
   const length=Math.hypot(dx,dy),nx=dy/length,ny=-dx/length;if(!(nx<0)||dy===0)return false;
   const t=(-ay-R*ny)/dy;if(!oneSided&&(t<0||t>1))return false;
   const n0x=(y1-y0)/length,n0y=-(x1-x0)/length,K=R+n0x*x0+n0y*y0,E=K+ny*this.axleY;
   target.feature=feature;target.kind='edge';target.x=ax+t*dx+R*nx;target.first=this.axleY+E*ny/(nx*nx);target.second=this.axleY*ny/nx+E/nx+2*E*ny*ny/(nx*nx*nx);target.nx=nx;target.ny=ny;target.J=nx*target.first;target.margin=Math.min(t,1-t);return true;
  }
  if(!(Math.abs(ay)<R))return false;const d=Math.sqrt(R*R-ay*ay),nx=-d/R,ny=-ay/R,k=(i+n-1)%n,px=this.axleX+c*this.xy[2*k]!-s*this.xy[2*k+1]!,py=this.axleY+s*this.xy[2*k]!+c*this.xy[2*k+1]!;
  const before=nx*(px-ax)+ny*(py-ay),after=nx*dx+ny*dy;if(!oneSided&&(before>0||after>0))return false;
  const vx=-(ay-this.axleY),vy=ax-this.axleX,vxx=-(ax-this.axleX),vyy=-(ay-this.axleY);
  target.feature=feature;target.kind='vertex';target.x=ax-d;target.first=vx+ay*vy/d;target.second=vxx+(vy*vy+ay*vyy)/d+ay*ay*vy*vy/(d*d*d);target.nx=nx;target.ny=ny;target.J=nx*target.first;target.margin=Math.min(-before,-after);return true;
 }
 /** Signed sphere clearance against the actual polygon at the straight-deck
  * centreline. Unlike the left-contact oracle this handles either side and a
  * returning hammer. No nominal circle participates. */
 clearance(q:number,x:number):number{
  const c=Math.cos(q),s=Math.sin(q),n=this.xy.length/2;let distance=Infinity,inside=true;
  for(let i=0;i<n;i++){
   const j=(i+1)%n,ax=this.axleX+c*this.xy[2*i]!-s*this.xy[2*i+1]!,ay=this.axleY+s*this.xy[2*i]!+c*this.xy[2*i+1]!;
   const bx=this.axleX+c*this.xy[2*j]!-s*this.xy[2*j+1]!,by=this.axleY+s*this.xy[2*j]!+c*this.xy[2*j+1]!,dx=bx-ax,dy=by-ay;
   if(dx*(-ay)-dy*(x-ax)<0)inside=false;
   const t=Math.max(0,Math.min(1,((x-ax)*dx-ay*dy)/(dx*dx+dy*dy)));
   distance=Math.min(distance,Math.hypot(x-ax-t*dx,-ay-t*dy));
  }
  return(inside?-distance:distance)-this.radius;
 }
}

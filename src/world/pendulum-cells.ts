// UNUSED / UNRUN. Constructor-only derivation from actual packed profile vertices.
import{VillageAdmissibilityError}from'./village-contact';
import{PendulumProfile}from'./pendulum-profile';
import{blankBarContact,type FeaturePartition,type FeatureCell}from'./pendulum-types';
const bits=new DataView(new ArrayBuffer(8));
export function nextFloat(x:number,direction:-1|1):number{
 if(!Number.isFinite(x))return x;if(x===0)return direction*Number.MIN_VALUE;bits.setFloat64(0,x);let u=bits.getBigUint64(0);u+=(x>0?direction:-direction)>0?1n:-1n;bits.setBigUint64(0,u);return bits.getFloat64(0);
}
function failure(stop:number,detail:string):never{throw new VillageAdmissibilityError(stop,'striker-feature-indeterminate','unsupported-contact-geometry',1,0,detail);}
interface Boundary {readonly lo:number;readonly hi:number;readonly q:number;readonly decided:boolean}
/** Analytic trigonometric candidates cover every domain endpoint of every
 * offset edge/vertex. Active intervals are selected by the existing oracle.
 * No scanning pitch can silently skip a thin feature cell. */
export function featureCells(stop:number,profile:PendulumProfile,end:number):FeaturePartition{
 if(!(end>0&&end<Math.PI/2))failure(stop,'Only the existing first-quadrant forward sector is supported');
 const n=profile.xy.length/2,R=profile.radius,equations=new Map<string,readonly[number,number,number]>();
 const add=(a:number,b:number,c:number)=>equations.set(`${a}/${b}/${c}`,[a,b,c]);
 for(let i=0;i<n;i++){
  const j=(i+1)%n,x=profile.xy[2*i]!,y=profile.xy[2*i+1]!,x1=profile.xy[2*j]!,y1=profile.xy[2*j+1]!,length=Math.hypot(x1-x,y1-y),nx=(y1-y)/length,ny=-(x1-x)/length;
  // Either endpoint of the offset edge crosses the centre-height line.
  add(x+R*nx,y+R*ny,profile.axleY);add(x1+R*nx,y1+R*ny,profile.axleY);
  // Rounded vertex clears the line only when its disk reaches y=±R.
  add(x,y,profile.axleY-R);add(x,y,profile.axleY+R);
 }
 const boundaries:Boundary[]=[{lo:0,hi:0,q:0,decided:true},{lo:end,hi:end,q:end,decided:true}];
 for(const[A,B,C]of equations.values()){
  const amplitude=Math.hypot(A,B);if(amplitude===0||Math.abs(C)>amplitude)continue;
  const phi=Math.atan2(B,A),angle=Math.asin(-C/amplitude),f=(q:number)=>A*Math.sin(q)+B*Math.cos(q)+C;
  for(const seed of[angle-phi,Math.PI-angle-phi])for(let turn=-2;turn<=2;turn++){
   const q=seed+2*Math.PI*turn;if(!(q>0&&q<end))continue;
   let lo=nextFloat(q,-1),hi=nextFloat(q,1),decided=false;
   for(let expand=0;expand<64;expand++){
    if(f(lo)===0||f(hi)===0||f(lo)*f(hi)<0){decided=true;break;}
    const width=hi-lo;lo=Math.max(0,lo-width);hi=Math.min(end,hi+width);
   }
   if(decided){
    const sign=f(lo);for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;const value=f(mid);if(value===0){lo=hi=mid;break;}if(sign*value>0)lo=mid;else hi=mid;}
   }
   boundaries.push({lo,hi,q:(lo+hi)/2,decided});
  }
 }
 boundaries.sort((a,b)=>a.q-b.q);const nodes:Boundary[]=[];
 for(const b of boundaries){const last=nodes.at(-1);if(last&&b.lo<=last.hi){nodes[nodes.length-1]={lo:Math.min(last.lo,b.lo),hi:Math.max(last.hi,b.hi),q:(Math.min(last.lo,b.lo)+Math.max(last.hi,b.hi))/2,decided:last.decided&&b.decided};}else nodes.push(b);}
 const cells:FeatureCell[]=[],contact=blankBarContact();let clear:readonly[number,number]|undefined;
 for(let i=0;i+1<nodes.length;i++){
  const a=nodes[i]!,b=nodes[i+1]!,mid=(a.hi+b.lo)/2;if(mid===a.hi||mid===b.lo)failure(stop,'Unresolved adjacent feature candidates');
  const found=profile.sample(mid,contact);
  if(!found){if(!clear)clear=[a.lo,a.hi];continue;}
  if(clear)failure(stop,'Profile reappears after geometric clearance');
  const last=cells.at(-1);
  if(last&&last.feature===contact.feature){cells[cells.length-1]={...last,q1:b.q,end:[b.lo,b.hi]};continue;}
  if(!a.decided||!b.decided)failure(stop,'Active feature boundary has unresolved conditioning');
  cells.push({index:cells.length,feature:contact.feature,kind:contact.kind,q0:a.q,q1:b.q,start:[a.lo,a.hi],end:[b.lo,b.hi]});
 }
 if(!cells.length||cells[0]!.q0!==0)failure(stop,'No first actual packed contact cell');
 return Object.freeze({cells:Object.freeze(cells),clear,stop:end,topology:cells.map(c=>`${c.index}:${c.feature}:${c.kind}`).join('/')});
}
export function cellAt(partition:FeaturePartition,q:number,side:'left'|'right'='right'):FeatureCell|undefined{
 for(const c of partition.cells)if(q>=c.q0&&(q<c.q1||side==='left'&&q===c.q1))return c;return;
}

/** Local interval jets for this profile formula, coefficients = derivative/n!.
 * Outward Float64 arithmetic plus an explicit64eps libm model. This is an
 * analytic remainder calculation under that model, not a universal real-number
 * enclosure or a foreign-contact tolerance. Independent observation is required. */
export type Range=readonly[number,number];
const down=(x:number)=>nextFloat(x,-1),up=(x:number)=>nextFloat(x,1);
export const range={
 add:(a:Range,b:Range):Range=>[down(a[0]+b[0]),up(a[1]+b[1])],
 neg:(a:Range):Range=>[-a[1],-a[0]],
 mul:(a:Range,b:Range):Range=>{const v=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return[down(Math.min(...v)),up(Math.max(...v))];},
 div:(a:Range,b:Range):Range=>{if(b[0]<=0&&b[1]>=0)throw new Error('Profile interval denominator contains zero');return range.mul(a,[down(1/b[1]),up(1/b[0])]);},
};
export function trig(a:number,b:number,cosine=false):Range{
 const f=cosine?Math.cos:Math.sin,v=[f(a),f(b)],offset=cosine?0:Math.PI/2;
 for(let k=Math.ceil((a-offset)/Math.PI);k<=(b-offset)/Math.PI;k++)v.push(k%2===0?1:-1);
 const error=64*Number.EPSILON;return[down(Math.min(...v)-error),up(Math.max(...v)+error)];
}
export function profileDerivativeRange(profile:PendulumProfile,feature:number,a:number,b:number,order=3):readonly Range[]{
 const n=profile.xy.length/2,i=feature%n,j=(i+1)%n,N=order,factor=[1];for(let k=1;k<=N;k++)factor.push(factor[k-1]!*k);
 const scalar=(x:number):Range=>[x,x],constant=(x:number):Range[]=>Array.from({length:N+1},(_,k)=>scalar(k===0?x:0));
 const add=(x:readonly Range[],y:readonly Range[])=>x.map((v,k)=>range.add(v,y[k]!));
 const scale=(x:readonly Range[],v:number)=>x.map(r=>range.mul(r,scalar(v)));
 const mul=(x:readonly Range[],y:readonly Range[])=>Array.from({length:N+1},(_,k)=>{let s:Range=[0,0];for(let l=0;l<=k;l++)s=range.add(s,range.mul(x[l]!,y[k-l]!));return s;});
 const div=(x:readonly Range[],y:readonly Range[])=>{const z:Range[]=[];for(let k=0;k<=N;k++){let s=x[k]!;for(let l=1;l<=k;l++)s=range.add(s,range.neg(range.mul(y[l]!,z[k-l]!)));z.push(range.div(s,y[0]!));}return z;};
 const sqrt=(x:readonly Range[])=>{if(!(x[0]![0]>0))throw new Error('Profile interval reaches geometric clearance');const z:Range[]=[[down(Math.sqrt(x[0]![0])),up(Math.sqrt(x[0]![1]))]];for(let k=1;k<=N;k++){let s=x[k]!;for(let l=1;l<k;l++)s=range.add(s,range.neg(range.mul(z[l]!,z[k-l]!)));z.push(range.div(s,range.mul([2,2],z[0]!)));}return z;};
 const sin=Array.from({length:N+1},(_,k)=>range.mul(trig(a+k*Math.PI/2,b+k*Math.PI/2),scalar(1/factor[k]!))),cos=Array.from({length:N+1},(_,k)=>range.mul(trig(a+k*Math.PI/2,b+k*Math.PI/2,true),scalar(1/factor[k]!)));
 const x=profile.xy[2*i]!,y=profile.xy[2*i+1]!;let result:Range[];
 if(feature<n){const dx=profile.xy[2*j]!-x,dy=profile.xy[2*j+1]!-y,L=Math.hypot(dx,dy),nx0=dy/L,ny0=-dx/L,K=profile.radius+nx0*x+ny0*y;
  const nx=add(scale(cos,nx0),scale(sin,-ny0)),ny=add(scale(sin,nx0),scale(cos,ny0));result=add(constant(profile.axleX),div(add(constant(K),scale(ny,profile.axleY)),nx));
 }else{const px=add(constant(profile.axleX),add(scale(cos,x),scale(sin,-y))),py=add(constant(profile.axleY),add(scale(sin,x),scale(cos,y)));result=add(px,scale(sqrt(add(constant(profile.radius**2),scale(mul(py,py),-1))),-1));}
 return result.map((r,k)=>range.mul(r,scalar(factor[k]!)));
}

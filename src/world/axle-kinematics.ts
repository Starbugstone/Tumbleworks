import{VILLAGE_RADIUS}from'./village-plan';
// Mill111 selected axle implementation. Independent variable q is the rotor angle, never eased twice.
import {Matrix4} from 'three';
import{axlePose}from'./axle-pose';
import type {AxleStation,Inventory,Mass,Q,V} from './axle-types';
export const G=9.81;
export const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const add=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const scale=(a:V,s:number):V=>[a[0]*s,a[1]*s,a[2]*s];
export const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const K=(a:V):V=>[-a[1],a[0],0];
export const rot=(a:V,p:number):V=>[Math.cos(p)*a[0]-Math.sin(p)*a[1],Math.sin(p)*a[0]+Math.cos(p)*a[1],a[2]];
export class AxleKinematics {
 readonly spec;readonly R;readonly theta;readonly flip;readonly O:V;readonly pin:V;readonly entry;readonly delta;readonly f:V;
 constructor(readonly station:Pick<AxleStation,'anchor'|'mechanism'>){const m=station.mechanism;this.spec=m.axleCarry;this.R=m.radius;this.theta=m.angle;this.flip=m.angle-this.spec.tilt.window;this.entry=m.deckPitch??0;this.delta=this.spec.tilt.exitPitch-this.entry;this.pin=[...this.spec.pin,0];const p=rot(this.pin,this.entry);this.O=[station.anchor[0]+p[0],station.anchor[1]+p[1]+this.R,station.anchor[2]];
  // Equal margins selected by106, not fitted to sampled lever extrema.
  const v=1/6,hmax=this.flip+this.spec.tilt.window*v-2*this.delta/27,margin=(Math.PI-hmax)/2,arg=Math.PI-margin-this.entry-Math.PI/2;
  this.f=[this.spec.follower.length*Math.cos(arg),this.spec.follower.length*Math.sin(arg),0];
 }
 beta(q:number,side:'left'|'right'='right'){const w=this.spec.tilt.window;if(q<this.flip||q===this.flip&&side==='left')return{beta:0,b:0,bp:0};if(q>this.theta)return{beta:this.delta,b:0,bp:0};const u=(q-this.flip)/w;return{beta:this.delta*u*u*(3-2*u),b:this.delta*6*u*(1-u)/w,bp:this.delta*(6-12*u)/(w*w)};}
 at(u:number,T:number):Q{const q=this.theta*u*u*(3-2*u),b=this.beta(q);return{q,qd:this.theta*6*u*(1-u)/T,qdd:this.theta*(6-12*u)/(T*T),phi:this.entry+b.beta,b:b.b,bp:b.bp};}
 pose(q:number,target:Matrix4){return axlePose(this.station.mechanism,this.station.anchor,q,target);}
 point(local:V,q:number){const B=this.beta(q),a=rot([local[0]-this.pin[0],local[1]-this.pin[1],local[2]],this.entry+B.beta),p:V=[this.O[0]+this.R*Math.sin(q),this.O[1]-this.R*Math.cos(q),this.O[2]],dp:V=[this.R*Math.cos(q),this.R*Math.sin(q),0],ddp:V=[-this.R*Math.sin(q),this.R*Math.cos(q),0];return{X:add(p,a),A:add(dp,scale(K(a),B.b)),D:add(add(ddp,scale(K(a),B.bp)),scale(K(K(a)),B.b*B.b)),a};}
 follower(q:number){const B=this.beta(q),a=rot(this.f,this.entry+B.beta),er:V=[Math.sin(q),-Math.cos(q),0],w=add(scale(er,this.R),scale(a,B.b)),speed=Math.hypot(w[0],w[1]),nu=scale(w,1/speed),dF=K(w),ddF=add(scale(add(scale(er,this.R),scale(a,B.b*B.b)),-1),scale(K(a),B.bp));return{F:add([this.O[0]+this.R*er[0],this.O[1]+this.R*er[1],0],a),dF,ddF,nu,lever:cross(a,nu)[2],speed,curvature:cross(dF,ddF)[2]/speed**3};}
}
export class AxleMechanics {
 readonly k:AxleKinematics;readonly m;readonly Is;readonly r=.3;readonly source;readonly capacity;
 constructor(readonly station:AxleStation,readonly inventory:Inventory,readonly capturedX:number){this.k=new AxleKinematics(station);this.m=inventory.marble.mass;this.Is=inventory.marble.inertia;this.source=inventory.weight.mass*G*this.k.spec.spool.pitch;this.capacity=station.retention.brakeForce*inventory.caliperArm;}
 bodies(q:number,includeMarble=true){const h=this.inventory.head,rows=[this.inventory.carrier,{...h,centre:[h.centre[0]+this.capturedX+VILLAGE_RADIUS,h.centre[1],h.centre[2]]as V}];const result=rows.map(row=>({row,...this.k.point(row.centre,q)}));if(includeMarble)result.push({row:{body:'carrier',mass:this.m,centre:[this.capturedX,0,0],central:[0,0,0,0,0,0,0,0,this.Is],parts:[]} as Mass,...this.k.point([this.capturedX,0,0],q)});return result;}
 private readonly base={M:0,Mp:0,U:0,Up:0};
 private readonly force={ax:0,ay:0,acc:0,spinRate:0,normal:0,friction:0,head:0,governor:0,tension:0,slipSpeed:0,slipPower:0,exchangePower:0};
 private baseInto(q:Q,marble:boolean,target:{M:number;Mp:number;U:number;Up:number}){const k=this.k,sq=Math.sin(q.q),cq=Math.cos(q.q),sp=Math.sin(q.phi),cp=Math.cos(q.phi),R=k.R,rotor=this.inventory.rotor;target.M=this.inventory.rotorAxleInertia+this.inventory.weight.mass*k.spec.spool.pitch**2;target.Mp=0;target.U=rotor.mass*G*(k.O[1]+sq*rotor.centre[0]+cq*rotor.centre[1]);target.Up=rotor.mass*G*(cq*rotor.centre[0]-sq*rotor.centre[1]);
  for(let i=0;i<(marble?3:2);i++){const row=i===0?this.inventory.carrier:this.inventory.head,x=(i===2?this.capturedX:row.centre[0]+(i===1?this.capturedX+VILLAGE_RADIUS:0))-k.pin[0],y=(i===2?0:row.centre[1])-k.pin[1],mass=i===2?this.m:row.mass,I=i===2?this.Is:row.central[8],ax=cp*x-sp*y,ay=sp*x+cp*y,Ax=R*cq-q.b*ay,Ay=R*sq+q.b*ax,Dx=-R*sq-q.bp*ay-q.b*q.b*ax,Dy=R*cq+q.bp*ax-q.b*q.b*ay;target.M+=mass*(Ax*Ax+Ay*Ay)+I*q.b*q.b;target.Mp+=2*(mass*(Ax*Dx+Ay*Dy)+I*q.b*q.bp);target.U+=mass*G*(k.O[1]-R*cq+ay);target.Up+=mass*G*Ay;}
 }
 closed(q:number,marble=true){const b=this.k.beta(q);this.baseInto({q,qd:0,qdd:0,phi:this.k.entry+b.beta,b:b.b,bp:b.bp},marble,this.base);return{...this.base};}
 /** One scalar force law used by compiler AND allocation-free absolute queries. */
 forceInto(q:Q,s:number,v:number,omega:number,mode:'attached'|'roll'|'slip',sign:number,target:{ax:number;ay:number;acc:number;spinRate:number;normal:number;friction:number;head:number;governor:number;tension:number;slipSpeed:number;slipPower:number;exchangePower:number}){
  const k=this.k,c=this.capturedX-(mode==='attached'?0:s)-k.pin[0],sp=Math.sin(q.phi),cp=Math.cos(q.phi),sq=Math.sin(q.q),cq=Math.cos(q.q),Ax=k.R*cq-q.b*c*sp,Ay=k.R*sq+q.b*c*cp,Dx=-k.R*sq-q.bp*c*sp-q.b*q.b*c*cp,Dy=k.R*cq+q.bp*c*cp-q.b*q.b*c*sp,baseX=Ax*q.qdd+Dx*q.qd*q.qd+(mode==='attached'?0:2*q.b*sp*q.qd*v),baseY=Ay*q.qdd+Dy*q.qd*q.qd-(mode==='attached'?0:2*q.b*cp*q.qd*v),alpha=q.b*q.qdd+q.bp*q.qd*q.qd,N=this.m*(-baseX*sp+(baseY+G)*cp),drive=G*sp+baseX*cp+baseY*sp;
  let acc=0,f=0,wd=alpha,L=0;if(mode==='attached'){f=this.Is*alpha/this.r;L=f-this.m*(baseX*cp+(baseY+G)*sp);}else if(mode==='roll'){acc=(drive-this.Is*alpha/(this.m*this.r))/(1+this.Is/(this.m*this.r*this.r));wd=alpha+acc/this.r;f=this.Is*wd/this.r;}else{f=-.8*N*sign;acc=drive-f/this.m;wd=this.r*f/this.Is;}
  const ax=baseX-cp*acc,ay=baseY-sp*acc;this.baseInto(q,false,this.base);const exchange=this.m*(ax*Ax+(ay+G)*Ay)+this.Is*wd*q.b,governor=this.source-(this.base.M*q.qdd+.5*this.base.Mp*q.qd*q.qd+this.base.Up+exchange),slip=mode==='attached'?0:-v+this.r*(omega-q.b*q.qd);target.ax=ax;target.ay=ay;target.acc=acc;target.spinRate=wd;target.normal=N;target.friction=f;target.head=L;target.governor=governor;target.tension=this.inventory.weight.mass*(G-k.spec.spool.pitch*q.qdd);target.slipSpeed=slip;target.slipPower=mode==='attached'?0:-f*slip;target.exchangePower=mode==='attached'?0:exchange*q.qd;
 }
 attached(q:Q){this.forceInto(q,0,0,q.b*q.qd,'attached',0,this.force);const r=this.force;return{a:[r.ax,r.ay,0]as V,N:r.normal,f:r.friction,L:r.head,governor:r.governor,tension:r.tension};}
 free(q:Q,s:number,v:number,omega:number,mode:'roll'|'slip',slipSign:number){this.forceInto(q,s,v,omega,mode,slipSign,this.force);const r=this.force;return{acc:r.acc,wd:r.spinRate,N:r.normal,f:r.friction,a:[r.ax,r.ay,0]as V,slip:r.slipSpeed,dissipation:r.slipPower,exchange:r.exchangePower,governor:r.governor,tension:r.tension};}
 // Uses the SIGNED current source receipt; ring capacity is one aggregate5N patch.
 captureHold(a:number,q:number,marbleX:number,headX:number){const b=this.k.beta(q);if(b.b!==0)throw new Error('Capture dock must have zero beta prime');const c=this.closed(q,false),e=this.k.point([marbleX,0,0],q),h=this.k.point([headX,this.inventory.head.centre[1],this.inventory.head.centre[2]],q),east:V=[Math.cos(this.k.entry),Math.sin(this.k.entry),0];return this.source-c.Up-this.m*G*e.A[1]-a*(this.m*dot(east,e.A)+this.inventory.head.mass*dot(east,h.A));}
 energy(q:Q,s:number,v:number,omega:number){const p=this.k.point([this.capturedX-s,0,0],q.q),w:V=[-Math.cos(q.phi),-Math.sin(q.phi),0],velocity=add(scale(p.A,q.qd),scale(w,v)),c=this.closed(q.q,false);return{K:.5*c.M*q.qd*q.qd+.5*this.m*dot(velocity,velocity)+.5*this.Is*omega*omega,U:c.U+this.m*G*p.X[1]};}
}

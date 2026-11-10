import {assertContact,VillageAdmissibilityError,type SphereBody,type CoulombContact,type FrictionlessUnilateralHead} from './village-contact';
export interface CaptureSpec {
 /** headMass is the complete translating receiving assembly, including any locked fork. */
 readonly incomingSpeed:number; readonly headMass:number; readonly brakeForce:number;
 readonly downhillAcceleration:number; readonly normalAcceleration:number; readonly availableStroke:number;
}
export type CapturePhase='braking-slip'|'braking-roll'|'held-slip'|'held-rest';
export interface CaptureEvent {
 readonly kind:CapturePhase;readonly start:number;readonly end:number;readonly x0:number;readonly v0:number;readonly spin0:number;
 readonly angle0:number;readonly a:number;readonly spinRate:number;readonly floorNormal:number;readonly floorFriction:number;readonly headReaction:number;readonly brake:number;
}
export interface CaptureState {distance:number;speed:number;spin:number;angle:number}
export class VillageCapture {
 readonly impact;readonly events:readonly CaptureEvent[];readonly centreStop:number;readonly settledAt:number;readonly stroke:number;readonly work;
 distance=0;speed=0;spin=0;angle=0;
 constructor(readonly spec:CaptureSpec,readonly body:SphereBody,readonly contact:CoulombContact,readonly head:FrictionlessUnilateralHead,readonly stop:number){
  const {mass:m,radius:R,centralInertia:I}=body,{incomingSpeed:incoming,headMass:h,brakeForce:F,downhillAcceleration:g,normalAcceleration:gn,availableStroke}=spec;
  if(![...Object.values(spec),m,R,I,contact.mu].every(Number.isFinite)||incoming<0||m<=0||h<0||R<=0||I<=0||F<=0||availableStroke<=0||contact.mu<=0||head.restitution!==0||head.kind!=='frictionless-unilateral'||contact.kind!=='coulomb-single')throw new VillageAdmissibilityError(stop,'impact','unsupported-contact-geometry',1,0);
  if(gn<=0)throw new VillageAdmissibilityError(stop,'capture','support-normal',Number.EPSILON,gn);
  this.body=Object.freeze({...body});this.spec=Object.freeze({...spec});this.contact=Object.freeze({...contact});this.head=Object.freeze({...head});
  const kappa=I/(m*R*R),mass=m+h,N=m*gn,events:CaptureEvent[]=[];
  let v=m*incoming/mass,w=incoming,x=0,time=0,angle=0,brakeWork=0,slipLoss=0;
  const loss=.5*m*incoming**2-.5*mass*v*v;
  this.impact=Object.freeze({vBefore:incoming,vAfter:v,spin:incoming,headImpulse:h*v,translatingMass:h,floorNormalImpulse:0 as const,floorTangentImpulse:0 as const,loss});
  const advance=(kind:CapturePhase,dt:number,a:number,f:number,brake:number)=>{
   const spinRate=-f/(m*kappa),B=m*g+f-m*a;
   assertContact(stop,kind,'head-compressive',-B,0);assertContact(stop,kind,'floor-cone',Math.abs(f),contact.mu*N);
   assertContact(stop,kind,'brake-bound',Math.abs(brake),F);
   if(!Number.isFinite(dt)||dt<0)throw new VillageAdmissibilityError(stop,kind,'unsupported-contact-geometry',1,0);
   const dx=v*dt+.5*a*dt*dt,q=v-w,dissipation=-f*(q*dt+.5*(a-spinRate)*dt*dt);
   assertContact(stop,kind,'energy-balance',-dissipation,0);
   events.push(Object.freeze({kind,start:time,end:time+dt,x0:x,v0:v,spin0:w,angle0:angle,a,spinRate,floorNormal:N,floorFriction:f,headReaction:B,brake}));
   angle+=(w*dt+.5*spinRate*dt*dt)/R;x+=dx;time+=dt;brakeWork+=brake*dx;slipLoss+=dissipation;v+=a*dt;w+=spinRate*dt;
  };
  for(let event=0;v>0&&event<8;event++){
   const q=v-w,stickA=(mass*g-F)/(mass+m*kappa),stickF=-m*kappa*stickA;
   let f:number,a:number,kind:CapturePhase;
   if(q===0&&Math.abs(stickF)<=contact.mu*N){f=stickF;a=stickA;kind='braking-roll';}
   else{const direction=q===0?Math.sign(g-F/mass):Math.sign(q);f=-contact.mu*N*direction;a=g+(f-F)/mass;kind='braking-slip';}
   if(a>=0)throw new VillageAdmissibilityError(stop,kind,'brake-bound',mass*g+f,F);
   const qdot=a+f/(m*kappa),stopTime=-v/a,slipTime=kind==='braking-slip'&&q*qdot<0?-q/qdot:Infinity;
   advance(kind,Math.min(stopTime,slipTime),a,f,F);
   if(stopTime<=slipTime)v=0;else w=v; // exact event boundary, no force/speed floor
  }
  if(v!==0)throw new VillageAdmissibilityError(stop,'capture','unsupported-contact-geometry',1,0);
  this.centreStop=time;this.stroke=x;assertContact(stop,'capture','stroke',x,availableStroke);
  if(w!==0){const f=contact.mu*N*Math.sign(w),hold=mass*g+f;
   assertContact(stop,'held-slip','hold-bound',Math.abs(hold),F);
   advance('held-slip',Math.abs(w)*m*kappa/Math.abs(f),0,f,hold);w=0;
  }
  assertContact(stop,'held-rest','head-compressive',-m*g,0);assertContact(stop,'held-rest','hold-bound',Math.abs(mass*g),F);
  this.settledAt=time;
  events.push(Object.freeze({kind:'held-rest',start:time,end:time,x0:x,v0:0,spin0:0,angle0:angle,a:0,spinRate:0,floorNormal:N,floorFriction:0,headReaction:m*g,brake:mass*g}));
  this.events=Object.freeze(events);
  const initial=.5*m*(1+kappa)*incoming**2,gravity=mass*g*x,residual=initial+gravity-loss-brakeWork-slipLoss;
  assertContact(stop,'capture','energy-balance',Math.abs(residual),128*Number.EPSILON*Math.max(1,initial));
  this.work=Object.freeze({initial,impact:loss,brake:brakeWork,slip:slipLoss,gravity,residual});
 }
 eventAt(seconds:number):CaptureEvent {
  if(!Number.isFinite(seconds))throw new Error('Invalid capture time');
  const t=Math.max(0,seconds);for(const event of this.events)if(t<event.end)return event;return this.events[this.events.length-1]!;
 }
 sample(seconds:number,target:CaptureState=this):void {
  const e=this.eventAt(seconds),dt=Math.max(0,Math.min(seconds,e.end)-e.start);
  target.distance=e.x0+e.v0*dt+.5*e.a*dt*dt;target.speed=e.v0+e.a*dt;target.spin=e.spin0+e.spinRate*dt;
  target.angle=e.angle0+(e.spin0*dt+.5*e.spinRate*dt*dt)/this.body.radius;
 }
}
export type CaptureSolution=VillageCapture;
export function solvePlanarCapture(body:SphereBody,contact:CoulombContact,head:FrictionlessUnilateralHead,spec:CaptureSpec,stop:number):CaptureSolution{return new VillageCapture(spec,body,contact,head,stop);}

/** Finite contact stroke on a level deck. The moving pusher stays tangent to the
 * back of the marble; it cannot impart velocity without paying force × stroke.
 */
export class VillagePush {
  readonly duration: number;
  readonly work: number;
  readonly exitSpeed: number;
  private readonly acceleration: number;
  distance = 0;
  speed = 0;
  constructor(readonly mass: number, readonly inertiaFactor: number, readonly force: number,
    readonly stroke: number, readonly incomingSpeed: number, availableWork: number) {
    if (![mass, inertiaFactor, force, stroke, incomingSpeed, availableWork].every(Number.isFinite)
      || mass <= 0 || inertiaFactor < 1 || force <= 0 || stroke <= 0 || incomingSpeed < 0 || availableWork < 0) throw new Error('Invalid finite push');
    this.work = force * stroke;
    if (this.work > availableWork) throw new Error('Visible drive cannot pay for push');
    this.acceleration = force / (mass * inertiaFactor);
    this.exitSpeed = Math.sqrt(incomingSpeed * incomingSpeed + 2 * this.acceleration * stroke);
    this.duration = 2 * stroke / (incomingSpeed + this.exitSpeed);
  }
  sample(seconds: number): void {
    if (!Number.isFinite(seconds)) throw new Error('Invalid push time');
    const t = Math.max(0, Math.min(this.duration, seconds));
    this.distance = this.incomingSpeed * t + .5 * this.acceleration * t * t;
    this.speed = this.incomingSpeed + this.acceleration * t;
  }
}

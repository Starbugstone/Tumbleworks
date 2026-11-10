/** Coupled rolling sphere / hinged deck. Gravity and initial impact energy are
 * the only sources; the bearing and end stop can only remove mechanical work. */
export interface GravityLeverSpec {
  marbleMass: number; bodyMass: number; bodyInertia: number;
  bodyCentre: readonly [number, number, number];
  tripX: number; bearingTorque: number; restitution: number; traction: number;
}
export interface LeverState { time: number; x: number; velocity: number; angle: number; angularVelocity: number }
export interface LeverRow extends LeverState { energy: number; reaction: number; traction: number }
interface LeverAssembly {
  pivot: readonly [number, number, number]; angle: number; deckPitch: number;
  entryX: number; exitX: number; radius: number; inertiaFactor: number;
}

export function legacyCompile(assembly: LeverAssembly, spec: GravityLeverSpec,
  start: number, incomingSpeed: number, step = 1 / 2000) {
  const {marbleMass:m,bodyMass:mb,bodyInertia:ib,bearingTorque:drag}=spec;
  const {pivot:p,deckPitch:phi,radius:r,inertiaFactor:k}=assembly;
  if (!(m>0 && mb>0 && ib>0 && k>=1 && r>0 && drag>=0 && spec.traction>=0 && incomingSpeed>0 && step>0)
    || spec.restitution!==0 || Math.abs(p[2])>1e-10 || Math.abs(spec.bodyCentre[2])>1e-10) throw new Error('Unsupported gravity lever');
  const direction=Math.sign(assembly.angle), c=Math.cos(phi), s=Math.sin(phi), g=9.81;
  if(!direction)throw new Error('Gravity lever has no stroke');
  const bx=c*spec.bodyCentre[0]-s*spec.bodyCentre[1]-p[0], by=s*spec.bodyCentre[0]+c*spec.bodyCentre[1]-p[1];
  // Authored inertia already includes the parallel-axis term and attached block.
  if(ib+1e-12<mb*(bx*bx+by*by))throw new Error('Hinge inertia is smaller than its parallel-axis minimum');
  const bodyPivotInertia=ib;
  const mxx=m*k, cross=m*(p[1]*c-p[0]*s-(k-1)*r);
  let docked=false;
  const evaluate=(state:LeverState)=>{
    const co=Math.cos(state.angle),si=Math.sin(state.angle),ex=co*c-si*s,ey=si*c+co*s;
    const ax=c*state.x-p[0],ay=s*state.x-p[1],wx=co*ax-si*ay,wy=si*ax+co*ay;
    const bodyX=co*bx-si*by,bodyY=si*bx+co*by;
    const q=state.x-p[0]*c-p[1]*s;
    const mtt=m*(ax*ax+ay*ay+(k-1)*r*r)+bodyPivotInertia;
    const rhsX=m*q*state.angularVelocity**2-m*g*ey;
    const rhsT=-2*m*q*state.velocity*state.angularVelocity-m*g*wx-mb*g*bodyX
      -drag*(Math.sign(state.angularVelocity)||direction);
    const det=mxx*mtt-cross*cross;
    if(!(det>0))throw new Error('Singular lever inertia');
    let acceleration=(rhsX*mtt-cross*rhsT)/det;
    let angularAcceleration=(mxx*rhsT-cross*rhsX)/det;
    if(docked || (direction*state.angle<=1e-12 && direction*angularAcceleration<0 && Math.abs(state.angularVelocity)<1e-10)) {
      angularAcceleration=0;acceleration=rhsX/mxx;
    }
    const axWorld=ex*acceleration-wy*angularAcceleration-2*ey*state.angularVelocity*state.velocity-wx*state.angularVelocity**2;
    const ayWorld=ey*acceleration+wx*angularAcceleration+2*ex*state.angularVelocity*state.velocity-wy*state.angularVelocity**2;
    const reaction=-ey*axWorld+ex*(ayWorld+g), tangent=ex*axWorld+ey*(ayWorld+g);
    if(reaction<=0)throw new Error('Gravity lever loses floor contact');
    if(Math.abs(tangent)>spec.traction*reaction+1e-8)throw new Error(`Gravity lever exceeds rolling traction at ${state.time}s x=${state.x}, v=${state.velocity}, angle=${state.angle}: required mu=${Math.abs(tangent)/reaction}, authored=${spec.traction}, reaction=${reaction}`);
    const energy=.5*mxx*state.velocity**2+cross*state.velocity*state.angularVelocity+.5*mtt*state.angularVelocity**2+m*g*wy+mb*g*bodyY;
    return {acceleration,angularAcceleration,reaction,energy,normalArm:q,traction:Math.abs(tangent)/reaction};
  };
  const derivative=(state:LeverState)=>{const d=evaluate(state);return [state.velocity,d.acceleration,state.angularVelocity,d.angularAcceleration] as const;};
  const shifted=(state:LeverState,h:number,d:readonly number[]):LeverState=>({time:state.time+h,x:state.x+h*d[0]!,velocity:state.velocity+h*d[1]!,angle:state.angle+h*d[2]!,angularVelocity:state.angularVelocity+h*d[3]!});
  const advance=(state:LeverState,h:number)=>{
    const a=derivative(state),b=derivative(shifted(state,h/2,a)),cc=derivative(shifted(state,h/2,b)),d=derivative(shifted(state,h,cc));
    return shifted(state,h,a.map((v,i)=>(v+2*b[i]!+2*cc[i]!+d[i]!)/6));
  };
  let state:LeverState={time:start,x:spec.tripX,velocity:incomingSpeed,angle:0,angularVelocity:0};
  const initialEnergy=evaluate(state).energy, rows:LeverRow[]=[];
  const append=()=>{const value=evaluate(state);if(value.energy>initialEnergy+1e-6)throw new Error('Unbacked gravity lever energy');rows.push({...state,energy:value.energy,reaction:value.reaction,traction:value.traction});};
  append();let stopLoss=0, stopNormalImpulse=0, stopTangentialImpulse=0;
  for(let iteration=0;iteration<120000;iteration++) {
    let next=advance(state,step);
    if(!docked && direction*(next.angle-assembly.angle)>=0) {
      let lo=0,hi=step;
      for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(direction*(advance(state,mid).angle-assembly.angle)>=0)hi=mid;else lo=mid;}
      next=advance(state,(lo+hi)/2);next.angle=assembly.angle;
      if(next.x>=assembly.exitX)throw new Error('Gravity lever reaches the outlet before docking');
      state=next;append();const before=evaluate(state);
      if(-state.angularVelocity*before.normalArm < -1e-8)throw new Error('Lever end stop requires a pulling floor impulse');
      const deltaOmega=-state.angularVelocity, deltaVelocity=cross/mxx*state.angularVelocity;
      stopNormalImpulse=m*before.normalArm*deltaOmega;
      stopTangentialImpulse=m*(deltaVelocity+(p[1]*c-p[0]*s)*deltaOmega);
      if(Math.abs(stopTangentialImpulse)>spec.traction*stopNormalImpulse+1e-10)throw new Error('Lever end stop exceeds available impulsive traction');
      state={...state,velocity:state.velocity+deltaVelocity,angularVelocity:0};docked=true;
      const after=evaluate(state);stopLoss=before.energy-after.energy;
      if(stopLoss < -1e-8)throw new Error('Lever stop creates energy');
      append();continue;
    }
    if(next.x>=assembly.exitX) {
      if(!docked)throw new Error('Gravity lever reaches the outlet before docking');
      let lo=0,hi=step;
      for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(advance(state,mid).x>=assembly.exitX)hi=mid;else lo=mid;}
      state=advance(state,(lo+hi)/2);state.x=assembly.exitX;append();
      return {rows,initialEnergy,stopLoss,stopNormalImpulse,stopTangentialImpulse,end:state.time,exitSpeed:state.velocity};
    }
    if(next.x<assembly.entryX)throw new Error('Gravity lever escapes through its entry');
    state=next;append();
  }
  throw new Error('Gravity lever cannot complete its physical stroke');
}

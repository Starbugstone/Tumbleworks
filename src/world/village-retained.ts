import{carrierWeldsCertified}from'./village-captive-welds';
import {CaptiveFrameGuide,captiveImpactCertificate,assertCaptiveImpact,type CaptiveFrameWitness,type CaptiveKinematics,type CaptiveImpactCertificate} from './village-keyed-frame';
import {openLockReceipt,assertOpenLock,OpenAngleGuide,type OpenLockReceipt} from './village-lock';
import {retainedInventory,type RetainedInventory} from './village-inventory';
import {legacyGateAllocation,VillageGate,releaseGeometry,type ReleaseState,type GateState} from './village-gate';
import {carryReceipt,assertCarryGovernor,solveCarryTiming,type CarryReceipt} from './village-carry';
import { CarriageBrake, type GuideWrench } from './village-carriage-guide';
import { Matrix4, Vector3, Triangle } from 'three';
import { carrierEdges, carrierContact, mechanismMatrix, villageEase, villageChannelGeometry } from '../view/machine-primitives';
import { villagePort, type VillageProfile, type VillageStation } from './village-plan';
import { VillageCapture } from './village-capture';
import {assertRotatingHeadClosure,assertContact,VillageAdmissibilityError,VILLAGE_CONTACT,VILLAGE_HEAD,type VillageLedgerEntry,type VillageContactWitness} from './village-contact';
import { FiniteDriveLedger } from './village-drive';

const FORK_RADIUS = .34;
const GATE_LIFT = .6;
export interface RetainedDriveWitness {
 frame?:CaptiveFrameWitness;
 phase:string;site:string;sourceEffort:number;governor:number;capacity:number;lineTension:number;
 requiredOpenLockImpulse:number;requiredOpenLockTorque:number;requiredClosedHoldTorque:number;requiredKeyTorque:number;holdCapacity:number;
}
export interface RetainedPose {
  localX: number; progress: number; forkX: number; forkAngle: number; forkLift: number; headLift?: number; weightDrop: number;
}

/** A real fork/damper captures, encloses and releases cargo on a graded deck.
 * The complete weight stroke is spent once, including body/rotor inertia,
 * gate work and governor losses. Release restarts from gravity, not arrival KE.
 */
export class VillageRetained {
  readonly captiveGuide?:CaptiveFrameGuide;
  readonly captiveImpact?:CaptiveImpactCertificate;
  get openingSite():'slot-shoe'|'captive-leaf-guide'{return this.inventory.layout==='keyed-prismatic'?'captive-leaf-guide':'slot-shoe';}
  readonly openLock?:OpenLockReceipt;
  readonly openGuide?:OpenAngleGuide;
  readonly inventory:RetainedInventory;
  readonly closing?:VillageGate;
  readonly opening:VillageGate;
  readonly closureEnd:number;
  readonly openingEnd:number;
  readonly carryAudit:CarryReceipt;
  readonly carriageBrake?:CarriageBrake;
  readonly carriageWrenches?:readonly GuideWrench[];
  readonly carriageHoldBounds?:Readonly<{capture:number;closure:number;release:number}>;
  readonly capture?: VillageCapture;
  readonly keyedHead: boolean;
  readonly closureStart:number;
  readonly physicalLedger:readonly VillageLedgerEntry[];
  private readonly witnessMatrix=new Matrix4();
  private readonly witnessNormal=new Vector3();
  private readonly witnessTangent=new Vector3();
  private readonly witnessScratch=new Vector3();
  readonly carryStart: number;
  readonly carryEnd: number;
  readonly end: number;
  readonly exitSpeed: number;
  readonly retainedX: number;
  readonly inputDirection: number;
  readonly outputDirection: number;
  readonly ledger: FiniteDriveLedger;
  readonly sourceId: string;
  readonly mechanicalWork: number;
  readonly governorLoss: number;
  private readonly carrySeconds: number;
  private readonly gateEnergy: number;
  private readonly carryEnergy: number;
  private readonly auditedCarryWork?:VillageLedgerEntry['work'];
  private readonly detachTime: number;
  private readonly detachDistance: number;
  private readonly detachSpeed: number;
  private readonly acceleration: number;
  private readonly matrix = new Matrix4();
  private readonly gateSample:GateState={q:0,qdot:0,qddot:0,governor:0,assist:0,lineTension:0};
  private readonly forceSample:VillageContactWitness={phase:'',floorNormal:0,floorFriction:0,leadingReaction:0,trailingReaction:0,brake:0};
  private readonly pose: RetainedPose = { localX: 0, progress: 0, forkX: 0, forkAngle: 0, forkLift: 0, weightDrop: 0 };
  private readonly distances: readonly number[];
  distance = 0;

  constructor(readonly station: VillageStation, readonly start: number, incomingSpeed: number, readonly inertiaFactor: number, profile:VillageProfile) {
    const spec = station.retention;
    if(spec?.opening!==undefined&&spec.opening!=='captive-leaf')throw new Error('Unknown retained opening mode');
    if (!spec || !('deckPitch' in station.mechanism) || !station.mechanism.deckPitch) throw new Error('Retained cargo needs a real graded deck');
    if (spec.bodyMass <= 0 || spec.bodyInertia < 0 || spec.rotorInertia < 0 || spec.acceleration <= 0 || spec.gateMass <= 0) throw new Error('Invalid retained body/drive');
    if(station.mechanism.kind==='launcher'&&(!spec.bodyCentre||spec.bodyInertia<=0))throw new Error('Retained launcher requires attached-body COM and positive central inertia');
    const bodyCentre=spec.bodyCentre??[0,-.4,0];
    if(!bodyCentre.every(Number.isFinite))throw new Error('Invalid retained body COM');
    this.proveFloor(profile);
    this.inventory=retainedInventory(spec,profile,spec.opening==='captive-leaf'?'keyed-prismatic':station.initialCargo?'rigid-gate':'keyed-split');
    const allocation=legacyGateAllocation(spec);
    const edges = carrierEdges(station.mechanism);
    this.inputDirection = -Math.sign(edges[0]); this.outputDirection = Math.sign(edges[1]);
    const pitch = station.mechanism.deckPitch;
    if (station.initialCargo && (station.stop !== 9 || incomingSpeed !== 0)) throw new Error('Only the first cradle can start loaded at rest');
    if (station.retainAtEnd && station.stop !== 0) throw new Error('Only the terminal carrier may keep its cargo');
    this.acceleration = -9.81 * station.exit.tangent[1] / inertiaFactor;
    if (!station.retainAtEnd && this.acceleration <= 0) throw new Error(`Stop ${station.stop}: released cargo cannot descend toward outlet`);
    if (!station.initialCargo) this.capture = new VillageCapture({ incomingSpeed,
      headMass: this.inventory.translatingMass, brakeForce: spec.brakeForce,
      downhillAcceleration: -9.81 * Math.sin(pitch) * this.inputDirection, normalAcceleration:9.81*Math.cos(pitch), availableStroke: spec.captureStroke },
      {mass:spec.marbleMass,radius:.3,centralInertia:.4*spec.marbleMass*.3**2},VILLAGE_CONTACT,VILLAGE_HEAD,station.stop);
    this.retainedX = station.initialCargo?.localX ?? spec.captureStart + this.inputDirection * this.capture!.stroke;
    if (Math.abs(this.retainedX) + FORK_RADIUS > .8) throw new Error('Captured sphere/fork exceeds deck');
    this.keyedHead=!!this.capture&&['terracotta','plank','timber'].includes(profile)&&['release','translating','suspended'].includes(station.mechanism.kind);
    if(this.inventory.layout==='keyed-prismatic'){
      if(!this.capture||!this.keyedHead||this.inputDirection!==1||this.outputDirection!==1)throw new VillageAdmissibilityError(station.stop,'captive-frame','unsupported-contact-geometry',1,0,'Explicit captive layout requires the supported planar captured assembly');
      const first=spec.captureStart+.34,last=this.retainedX+.34;
      this.captiveGuide=CaptiveFrameGuide.enrol(station,profile,first,last);
    }
    if(this.capture&&!this.keyedHead)assertRotatingHeadClosure(station.stop,.04,16,this.capture.eventAt(this.capture.centreStop).headReaction);
    this.opening=new VillageGate(station.stop,'release-drive',allocation,{kind:'lift',mass:this.inventory.layout==='keyed-prismatic'?this.inventory.openingMass:this.inventory.translatingMass,normalGravity:9.81*station.exit.normal[1],marbleMass:spec.marbleMass,tangentGravity:-9.81*station.exit.tangent[1],rollingFactor:inertiaFactor,capacity:spec.brakeForce},spec.weightMass);
    if(this.capture){
      const c=this.inventory.fork.centre,angle=pitch-Math.PI/2;
      this.closing=new VillageGate(station.stop,'closure',allocation,{kind:'closure',mass:spec.gateMass,inertia:this.inventory.fork.axleInertia,openCentre:[c[0]*Math.cos(angle)-c[1]*Math.sin(angle),c[0]*Math.sin(angle)+c[1]*Math.cos(angle)],capacity:spec.brakeForce*.012},spec.weightMass);
    }
    if(this.capture){
      this.openLock=openLockReceipt(spec.gateMass,this.inventory.fork.centre,this.inputDirection,this.capture.impact.vAfter,this.capture.events[0]!.a,pitch);
      this.openGuide=OpenAngleGuide.enrol(station,profile,spec.captureStart+this.inputDirection*FORK_RADIUS,this.retainedX+this.inputDirection*FORK_RADIUS,start,this.capture,this.inventory.fork.centre,this.inputDirection);
      assertOpenLock(station.stop,this.openLock,this.openGuide);
    }
    this.sourceId = `village-${station.stop}-weight`;
    this.ledger = new FiniteDriveLedger([{ id: this.sourceId, meshId: this.sourceId, kind: 'weight',
      mass: spec.weightMass, top: station.anchor[1] + 2, bottom: station.anchor[1] + 2 - spec.weightDrop }], 9.81,
    source => source.meshId === this.sourceId && source.kind === 'weight');
    this.gateEnergy=allocation.energy;
    if (!station.initialCargo) this.ledger.draw(this.sourceId, 'fork-close', this.gateEnergy);
    if (!station.retainAtEnd) this.ledger.draw(this.sourceId, 'fork-open', this.gateEnergy);
    this.carryEnergy = this.ledger.available(this.sourceId);
    if (this.carryEnergy <= 0) throw new Error('Weight cannot operate retention gates');

    const previous = new Vector3(), current = new Vector3();
    let travel = 0;
    for (let i = 0; i <= 240; i++) {
      mechanismMatrix(station.mechanism, station.anchor, i / 240, this.matrix);
      current.set(this.retainedX, 0, 0).applyMatrix4(this.matrix);
      if (i) travel += previous.distanceTo(current);
      previous.copy(current);
    }
    const angle = 'angle' in station.mechanism ? Math.abs(station.mechanism.angle) : 0;
    // Include the body's furthest operating radius rather than timing a short
    // off-centre cargo arc as though the rest of the assembly had no inertia.
    const stroke = Math.max(travel, angle * .8);
    if (stroke <= 0) throw new Error('Retained drive has no travel');
    const docking = 'dockingLift' in station.mechanism ? station.mechanism.dockingLift ?? 0 : 0;
    const legacyCarrySeconds = Math.max(Math.sqrt(6 * stroke / spec.acceleration / (docking ? .36 : 1)),
      docking ? Math.sqrt(6 * docking / (.04 * Math.min(spec.acceleration, 7))) : 0);
    const travelVector='travel'in station.mechanism&&typeof station.mechanism.travel!=='number'?station.mechanism.travel:undefined;
    if(!travelVector)throw new VillageAdmissibilityError(station.stop,'carry','unsupported-contact-geometry',1,0);
    this.carriageBrake=CarriageBrake.enrol(station,profile);
    if(this.inventory.layout==='keyed-prismatic'){
      if(!this.capture||!this.openGuide||!this.captiveGuide||!CarriageBrake.certified(this.carriageBrake,station.stop))throw new VillageAdmissibilityError(station.stop,'captive-guide','unsupported-contact-geometry',1,0,'All actual moving guides must exist');
      this.captiveImpact=captiveImpactCertificate(station.stop,this.inventory,this.capture.impact,this.openGuide.impulse,this.carriageBrake,mechanismMatrix(station.mechanism,station.anchor,0,new Matrix4()));
      assertCaptiveImpact(station.stop,this.captiveImpact,this.captiveGuide);
    }

    const carryTiming=this.carriageBrake?solveCarryTiming(station.stop,spec.bodyMass+spec.marbleMass+this.inventory.translatingMass,
      travelVector,spec.acceleration,this.carryEnergy,spec.weightMass,this.carriageBrake.capacity):undefined;
    this.carrySeconds=carryTiming?.duration??legacyCarrySeconds;
    this.closureStart=start+(this.capture?.centreStop??0);
    this.closureEnd=this.closureStart+(this.closing?.duration??0);
    this.carryStart = station.initialCargo ? start : Math.max(start+this.capture!.settledAt,this.closureEnd);
    this.carryEnd = this.carryStart + this.carrySeconds;
    this.openingEnd=this.carryEnd+this.opening.duration;
    this.carryAudit=carryReceipt(spec.bodyMass+spec.marbleMass+this.inventory.translatingMass,travelVector,this.carrySeconds,this.carryEnergy,spec.weightMass);
    assertCarryGovernor(station.stop,this.carryAudit,this.carriageBrake);
    this.auditedCarryWork=Object.freeze({gravity:-this.carryAudit.potential,brake:this.carryAudit.governorWork,slip:0,impact:0,drive:this.carryEnergy});
    if(this.carriageBrake){
      const total=spec.bodyMass+spec.marbleMass+this.inventory.translatingMass;
      const centre=new Vector3(...bodyCentre).multiplyScalar(spec.bodyMass).addScaledVector(new Vector3(this.retainedX,0,0),spec.marbleMass);
      const axle=this.retainedX+this.inputDirection*FORK_RADIUS;
      for(const rigid of(this.inventory.layout==='keyed-prismatic'?[this.inventory.frame,this.inventory.head,this.inventory.fork]:[this.inventory.head,this.inventory.fork]))centre.addScaledVector(new Vector3(...rigid.centre).add(new Vector3(axle,0,0)),rigid.mass);
      centre.divideScalar(total).applyMatrix4(mechanismMatrix(station.mechanism,station.anchor,0,this.matrix));
      const point=new Vector3(...this.carriageBrake.origin),axis=new Vector3(...this.carriageBrake.tangent);
      // The ideal train and symmetric brake load the carriage at the guide
      // centre. The guide carries the remaining transverse force and moment.
      // Both required wrenches are affine in cubic progress; nonnegative endpoint
      // allocations interpolate into a nonnegative allocation for every time.
      this.carriageWrenches=Object.freeze([1,-1].map(sign=>{
        const required=new Vector3(...travelVector).multiplyScalar(sign*6/this.carrySeconds**2).add(new Vector3(0,9.81,0)).multiplyScalar(total);
        const moment=new Vector3().subVectors(centre,point).cross(required);
        required.addScaledVector(axis,-required.dot(axis));
        if(![...required.toArray(),...moment.toArray()].every(Number.isFinite))throw new VillageAdmissibilityError(station.stop,'carry-guide-wrench','unsupported-contact-geometry',1,0);
        return Object.freeze({force:Object.freeze(required.toArray()),moment:Object.freeze(moment.toArray())});
      }));
      const tangent=new Vector3(1,0,0).transformDirection(this.matrix),up=new Vector3(0,1,0).transformDirection(this.matrix);
      const staticForce=total*9.81*Math.abs(axis.y);
      const capture=staticForce+(this.capture?Math.max(...this.capture.events.map(e=>Math.abs(e.a)))*(spec.marbleMass+this.inventory.translatingMass)*Math.abs(tangent.dot(axis)):0);
      const forkRadius=this.inventory.fork.maximumRadius;
      const closure=staticForce+(this.closing?spec.gateMass*forkRadius*(6*(Math.PI/2)/this.closing.duration**2+(1.5*(Math.PI/2)/this.closing.duration)**2):0);
      const release=staticForce+(this.inventory.layout==='keyed-prismatic'?this.inventory.openingMass:this.inventory.translatingMass)*6*GATE_LIFT/this.opening.duration**2*Math.abs(up.dot(axis))
        +spec.marbleMass*this.acceleration*Math.abs(tangent.dot(axis));
      for(const [phase,required]of Object.entries({capture,closure,release}))assertContact(station.stop,`carriage-${phase}-hold`,'hold-bound',required,this.carriageBrake.capacity);
      this.carriageHoldBounds=Object.freeze({capture,closure,release});
    }
    const body = new Vector3(), cargo = new Vector3(), a = new Vector3(), b = new Vector3(), normal = new Vector3();
    const center = (u: number, x: number, y: number, target: Vector3, z=0) => {
      mechanismMatrix(station.mechanism, station.anchor, u, this.matrix); target.set(x, y, z).applyMatrix4(this.matrix);
    };
    let previousEnergy = 0, previousPhase = 0, work = 0;
    const h = 1e-4;
    for (let frame = 0; frame <= 600; frame++) {
      const u = frame / 600, lo = Math.max(0, u - h), hi = Math.min(1, u + h);
      center(u, bodyCentre[0]!, bodyCentre[1]!, body, bodyCentre[2]); center(lo, bodyCentre[0]!, bodyCentre[1]!, a, bodyCentre[2]); center(hi, bodyCentre[0]!, bodyCentre[1]!, b, bodyCentre[2]);
      const bodySpeedSquared = b.sub(a).lengthSq() / ((hi - lo) * this.carrySeconds) ** 2;
      center(u, this.retainedX, 0, cargo); center(lo, this.retainedX, 0, a); center(hi, this.retainedX, 0, b);
      const cargoSpeedSquared = b.clone().sub(a).lengthSq() / ((hi - lo) * this.carrySeconds) ** 2;
      const rotationPhase = docking ? Math.max(0, Math.min(1, (u - .2) / .6)) : u;
      const angularSpeed = angle * 6 * rotationPhase * (1 - rotationPhase) / (this.carrySeconds * (docking ? .6 : 1));
      const rotatingInertia = ('pivot' in station.mechanism ? spec.bodyInertia : 0) + spec.rotorInertia;
      const energy = .5 * spec.bodyMass * bodySpeedSquared + .5 * (spec.marbleMass + spec.headMass + spec.gateMass) * cargoSpeedSquared
        + .5 * rotatingInertia * angularSpeed ** 2 + 9.81 * (spec.bodyMass * body.y + (spec.marbleMass + spec.headMass + spec.gateMass) * cargo.y);
      const phase = villageEase(u);
      if (frame) {
        const increment = Math.max(0, energy - previousEnergy);
        work += increment;
        if (increment > this.carryEnergy * (phase - previousPhase) + 1e-8) throw new Error(`Stop ${station.stop}: weight force/torque cannot drive actual assembly at ${u}: ${increment} > ${this.carryEnergy * (phase - previousPhase)}`);
      }
      if (u > h && u < 1 - h) {
        const acceleration = a.add(b).addScaledVector(cargo, -2).multiplyScalar(1 / (h * this.carrySeconds) ** 2);
        mechanismMatrix(station.mechanism, station.anchor, u, this.matrix);
        normal.set(0, 1, 0).transformDirection(this.matrix);
        if (acceleration.add(new Vector3(0, 9.81, 0)).dot(normal) <= 0) throw new Error('Retained marble loses floor support');
      }
      previousEnergy = energy; previousPhase = phase;
    }
    this.mechanicalWork = work;
    // Publish the existing signed carry receipt for every supported profile.
    // No force, motion, source allocation or peak-work calculation changes.
    this.governorLoss = this.carryAudit.governorWork;
    this.ledger.draw(this.sourceId, 'body-rotor-and-governor', this.carryEnergy);

    // While the upper bar lifts, solve its circular contact with the marble.
    // Detach when following it would require a pulling contact force.
    if (station.retainAtEnd) {
      this.detachTime = 0; this.detachDistance = 0; this.detachSpeed = 0; this.exitSpeed = 0; this.end = this.carryEnd;
    } else {
    this.detachTime=this.opening.detachTime;
    const detachLift = GATE_LIFT * villageEase(this.detachTime / this.opening.duration);
    if (Math.asin(detachLift / .3) >= Math.PI / 16) throw new Error('Fork release reaches a different bar facet before detachment');
    const detach = this.releaseConstraint(this.detachTime);
    this.detachDistance = detach.distance; this.detachSpeed = detach.speed;
    const remaining = Math.abs(edges[1] - this.retainedX) - this.detachDistance;
    if (remaining <= 0) throw new Error('Fork release exceeds actual deck length');
    this.exitSpeed = Math.sqrt(this.detachSpeed ** 2 + 2 * this.acceleration * remaining);
    this.end = this.carryEnd + this.detachTime + 2 * remaining / (this.detachSpeed + this.exitSpeed);
    }
    if(!station.retainAtEnd&&this.openingEnd>this.end)throw new VillageAdmissibilityError(station.stop,'release-drive','unsupported-contact-geometry',this.openingEnd,this.end,'Gate opening would outlast the station');
    if(this.captiveGuide){
      const checks=new Set([this.start,this.closureStart,this.closureEnd,this.carryStart,this.carryEnd,this.openingEnd,this.end,...(this.capture?.events.flatMap(e=>[this.start+e.start,this.start+e.end])??[])]);
      for(let i=0;i<=600;i++)checks.add(this.start+(this.end-this.start)*i/600);
      // Diagnostic samples supplement the exact finite face/impulse certificates;
      // they are NOT a claim of a continuous-time wrench-capacity proof.
      for(const time of checks)this.captiveWitness(time);
    }
    this.physicalLedger=this.compileContactLedger();
    const distances = [0];
    this.samplePoint(start, previous);
    for (let i = 1; i <= Math.ceil((this.end - start) * 240); i++) {
      this.samplePoint(Math.min(this.end, start + i / 240), current);
      distances.push(distances[i - 1]! + current.distanceTo(previous)); previous.copy(current);
    }
    this.distances = distances;
  }

  private proveFloor(profile:VillageProfile):void {
    const station=this.station,m=station.mechanism,contact=carrierContact(m);
    const fail=()=>{throw new VillageAdmissibilityError(station.stop,'retained-support','unsupported-contact-geometry',1,0);};
    if(contact.some(value=>value!==0)||this.inertiaFactor!==1.4)fail();
    // The capture is stationary at progress 0. Verify the actual generated floor,
    // not merely a profile label or effective rolling inertia.
    const geometry=villageChannelGeometry([villagePort([-.8,0,0]),villagePort([.8,0,0])],profile);
    try {
      const vertices=geometry.getAttribute('position'),indices=geometry.getIndex()!,a=new Vector3(),b=new Vector3(),c=new Vector3(),point=new Vector3(),triangle=new Triangle(),normal=new Vector3();
      for(const x of [-.79,0,.79])for(const z of [-.1,0,.1]){
        point.set(x,-.3,z);let supported=false;
        for(let i=0;i<indices.count;i+=3){a.fromBufferAttribute(vertices,indices.getX(i));b.fromBufferAttribute(vertices,indices.getX(i+1));c.fromBufferAttribute(vertices,indices.getX(i+2));
          triangle.set(a,b,c);triangle.getNormal(normal);
          if(normal.y>.999999&&Math.abs(a.y+.3)<2e-8&&Math.abs(b.y+.3)<2e-8&&Math.abs(c.y+.3)<2e-8&&triangle.containsPoint(point)){supported=true;break;}}
        if(!supported)fail();
      }
    } finally {geometry.dispose();}
    // Rigid spin on a rotating retained carrier needs its own torque audit.
    // Do not borrow the translation force balance for a hinge or orbital cup.
    if(!('travel' in m)||typeof m.travel==='number'||'pivot' in m)fail();
    if('travel' in m&&typeof m.travel!=='number'&&m.travel[2]!==0)fail();
  }
  driveWitness(seconds:number,target:RetainedDriveWitness):void {
    const spec=this.station.retention!,pitch=('deckPitch'in this.station.mechanism?this.station.mechanism.deckPitch:0)??0;
    if(this.captiveGuide)target.frame=this.captiveWitness(seconds);else if('frame'in target)delete target.frame;
    target.requiredOpenLockImpulse=0;target.requiredOpenLockTorque=0;target.requiredClosedHoldTorque=0;target.requiredKeyTorque=0;target.holdCapacity=spec.brakeForce*.012;
    target.sourceEffort=0;target.governor=0;target.capacity=0;target.lineTension=spec.weightMass*9.81;
    if(this.capture&&seconds<this.closureStart){const e=this.capture.eventAt(seconds-this.start);target.phase='capture';target.site='slot-shoe';target.governor=e.brake;target.capacity=spec.brakeForce;target.requiredOpenLockImpulse=this.openLock?.requiredImpulse??0;target.requiredOpenLockTorque=this.openLock?.requiredBrakingTorque??0;return;}
    if(this.closing&&seconds<this.closureEnd){this.closing.sample(seconds-this.closureStart,this.gateSample);target.phase='closure';target.site='journal-shoe';target.sourceEffort=this.closing.sourceEffort;target.governor=this.gateSample.governor;target.capacity=this.closing.axis.capacity;target.lineTension=this.gateSample.lineTension;return;}
    let ax=0,ay=0;
    if(seconds>=this.carryStart&&seconds<this.carryEnd){
      const u=(seconds-this.carryStart)/this.carrySeconds,a=6*(1-2*u)/this.carrySeconds**2,m=this.station.mechanism;
      if('travel'in m&&typeof m.travel!=='number'){ax=a*(m.travel[0]*Math.cos(pitch)+m.travel[1]*Math.sin(pitch));ay=a*(-m.travel[0]*Math.sin(pitch)+m.travel[1]*Math.cos(pitch));}
      target.phase='carry';target.site='carriage-guide';target.capacity=this.carriageBrake!.capacity;target.sourceEffort=this.carryEnergy/this.carryAudit.length;target.governor=(this.carryEnergy-this.carryAudit.potential-this.carryAudit.effectiveMass*a)/this.carryAudit.length;target.lineTension=spec.weightMass*(9.81-this.carryAudit.sourceRatio*a);
    }else if(seconds>=this.carryEnd&&seconds<=this.openingEnd&&!this.station.retainAtEnd){
      this.opening.sample(seconds-this.carryEnd,this.gateSample);ay=this.inventory.layout==='keyed-prismatic'?0:this.gateSample.qddot;target.phase='opening';target.site=this.openingSite;target.sourceEffort=this.opening.sourceEffort;target.governor=this.gateSample.governor;target.capacity=this.opening.axis.capacity;target.lineTension=this.gateSample.lineTension;
    }else{target.phase='closed-hold';target.site='journal-shoe';target.capacity=target.holdCapacity;}
    const c=this.inventory.fork.centre;target.requiredClosedHoldTorque=-spec.gateMass*(c[0]*(-9.81*Math.cos(pitch)-ay)-c[1]*(-9.81*Math.sin(pitch)-ax));
    this.contactWitness(seconds,this.forceSample);const dt=Math.max(0,seconds-this.carryEnd),lift=seconds>=this.carryEnd&&dt<this.detachTime?.6*villageEase(dt/this.opening.duration):0;
    const headTorque=.04*this.inputDirection*this.forceSample.leadingReaction*lift/.3;
    if(this.inventory.layout==='rigid-gate')target.requiredClosedHoldTorque+=headTorque;
    target.requiredKeyTorque=this.inventory.layout==='keyed-prismatic'?0:target.requiredClosedHoldTorque+(this.keyedHead?headTorque:0);
  }
  get carrierProofPending():boolean{return this.inventory.layout==='keyed-prismatic'&&(!carrierWeldsCertified(this)||this.fixedSidePending);}
  requireCarrierProof():void{if(this.inventory.layout==='keyed-prismatic'&&!carrierWeldsCertified(this))throw new VillageAdmissibilityError(this.station.stop,'captive-carrier-welds','unsupported-contact-geometry',1,0,'Actual carrier weld-chain certificate pending');this.requireFixedSide();}
  get fixedSidePending():boolean{return this.inventory.layout==='keyed-prismatic'&&!CarriageBrake.fixedSideCertified(this.carriageBrake,this.station.stop);}
  requireFixedSide():void{if(this.fixedSidePending)throw new VillageAdmissibilityError(this.station.stop,'captive-fixed-post','unsupported-contact-geometry',1,0,'Actual renderer fixed-side post certificate pending');}
  captiveWitness(seconds:number):CaptiveFrameWitness {
    if(!this.captiveGuide||this.inventory.layout!=='keyed-prismatic')throw new Error('No compiled captive assembly');
    const t=Math.max(this.start,Math.min(this.end,seconds)),p:RetainedPose={localX:0,progress:0,forkX:0,forkAngle:0,forkLift:0,headLift:0,weightDrop:0};this.state(t,p);
    const contact:VillageContactWitness={phase:'',floorNormal:0,floorFriction:0,leadingReaction:0,trailingReaction:0,brake:0};this.contactWitness(t,contact);
    let openGuide:import('./village-lock').OpenGuideLoad|undefined;const acceleration=new Vector3();let phase:CaptiveKinematics['phase']='closed-hold',omega=0,alpha=0,liftAcceleration=0,lineForce=this.opening.sourceRatio*this.station.retention!.weightMass*9.81,leafBrake=0;
    const pitch=('deckPitch'in this.station.mechanism?this.station.mechanism.deckPitch:0)??0;
    if(t<this.closureStart){phase='capture';const event=this.capture!.eventAt(t-this.start);acceleration.x=event.a*this.inputDirection;openGuide=this.openGuide!.braking[this.capture!.events.indexOf(event)];if(!openGuide)throw new Error('Missing actual open-follower braking witness');}
    else if(this.closing&&t<this.closureEnd){phase='closure';const u=Math.max(0,Math.min(1,(t-this.closureStart)/this.closing.duration));omega=Math.PI/2*6*u*(1-u)/this.closing.duration;alpha=Math.PI/2*(6-12*u)/this.closing.duration**2;const gate:GateState={q:0,qdot:0,qddot:0,governor:0,assist:0,lineTension:0};this.closing.sample(t-this.closureStart,gate);lineForce=this.opening.sourceRatio*gate.lineTension;}
    else if(t>=this.carryStart&&t<this.carryEnd){phase='carry';const m=this.station.mechanism;if(!('travel'in m)||typeof m.travel==='number'||m.travel[2]!==0)throw new Error('Unsupported captive travel');const q=6*(1-2*p.progress)/this.carrySeconds**2;acceleration.set(q*(m.travel[0]*Math.cos(pitch)+m.travel[1]*Math.sin(pitch)),q*(-m.travel[0]*Math.sin(pitch)+m.travel[1]*Math.cos(pitch)),0);lineForce=this.opening.sourceRatio*this.station.retention!.weightMass*(9.81-this.carryAudit.sourceRatio*q);}
    else if(t>=this.carryEnd&&t<=this.openingEnd&&!this.station.retainAtEnd){phase='opening';const gate:GateState={q:0,qdot:0,qddot:0,governor:0,assist:0,lineTension:0};this.opening.sample(t-this.carryEnd,gate);liftAcceleration=gate.qddot;lineForce=this.opening.sourceRatio*gate.lineTension;leafBrake=gate.governor;}
    return this.captiveGuide.witness(this.inventory,{phase,openGuide,forkX:p.forkX,lift:p.headLift??0,acceleration:acceleration.toArray(),angularSpeed:omega,angularAcceleration:alpha,forkAngle:p.forkAngle,liftAcceleration,lineForce,leafBrake,contact});
  }
  contactWitness(seconds:number,target:VillageContactWitness):void {
    const spec=this.station.retention!,m=this.station.mechanism;
    target.floorFriction=0;target.leadingReaction=0;target.trailingReaction=0;target.brake=0;
    if(this.capture&&seconds<this.carryStart){
      const elapsed=seconds>=this.closureStart?Math.max(this.capture.centreStop,seconds-this.start):seconds-this.start;
      const e=this.capture.eventAt(elapsed);target.phase=e.kind;target.floorNormal=e.floorNormal;
      target.floorFriction=e.floorFriction*this.inputDirection;target.leadingReaction=e.headReaction;target.brake=e.brake;return;
    }
    if(seconds<this.carryEnd){
      target.phase='carry';const u=Math.max(0,Math.min(1,(seconds-this.carryStart)/this.carrySeconds));
      mechanismMatrix(m,this.station.anchor,u,this.witnessMatrix);
      this.witnessNormal.setFromMatrixColumn(this.witnessMatrix,1);this.witnessTangent.setFromMatrixColumn(this.witnessMatrix,0);
      if(!('travel'in m)||typeof m.travel==='number')throw new VillageAdmissibilityError(this.station.stop,'carry','unsupported-contact-geometry',1,0);
      const acceleration=seconds<this.carryStart?0:6*(1-2*u)/this.carrySeconds**2;
      this.witnessScratch.set(...m.travel).multiplyScalar(acceleration).y+=9.81;
      target.floorNormal=spec.marbleMass*this.witnessScratch.dot(this.witnessNormal);
      const required=spec.marbleMass*this.witnessScratch.dot(this.witnessTangent)*this.inputDirection;
      target.leadingReaction=Math.max(0,-required);target.trailingReaction=Math.max(0,required);return;
    }
    target.phase='release';const dt=Math.max(0,seconds-this.carryEnd);
    const a=dt<this.detachTime?this.releaseConstraint(dt).acceleration:this.acceleration;
    const lift=dt<this.detachTime?GATE_LIFT*villageEase(dt/this.opening.duration):0;
    const sin=lift/.3,cos=Math.sqrt(1-sin*sin),gt=-9.81*this.station.exit.tangent[1];
    const head=dt<this.detachTime?spec.marbleMass*(gt-1.4*a)/cos:0;
    target.floorNormal=spec.marbleMass*9.81*this.station.exit.normal[1]+head*sin;
    target.floorFriction=-spec.marbleMass*.4*a*this.outputDirection;
    target.leadingReaction=head;
  }
  private compileContactLedger():readonly VillageLedgerEntry[]{
    const entries:VillageLedgerEntry[]=[],stop=this.station.stop,spec=this.station.retention!;
    const witness:VillageContactWitness={phase:'',floorNormal:0,floorFriction:0,leadingReaction:0,trailingReaction:0,brake:0};
    const record=(phase:string,start:number,end:number,work:VillageLedgerEntry['work'],sphereEnergy?:VillageLedgerEntry['sphereEnergy'])=>{
      let minimumNormal=Infinity,ratio=0,head=Infinity,brake=0;
      for(let i=0;i<=600;i++){
        const t=start+(end-start)*i/600;
        // Endpoints belong to the interval on the left for aggregate evidence.
        this.contactWitness(i===600&&end>start?end-Number.EPSILON*Math.max(1,end)*4:t,witness);
        if(witness.floorNormal<=0)throw new VillageAdmissibilityError(stop,phase,'support-normal',Number.EPSILON,witness.floorNormal);
        assertContact(stop,phase,'floor-cone',Math.abs(witness.floorFriction),VILLAGE_CONTACT.mu*witness.floorNormal);
        assertContact(stop,phase,'head-compressive',-witness.leadingReaction,0);
        assertContact(stop,phase,'head-compressive',-witness.trailingReaction,0);
        minimumNormal=Math.min(minimumNormal,witness.floorNormal);ratio=Math.max(ratio,Math.abs(witness.floorFriction)/witness.floorNormal);
        head=Math.min(head,witness.leadingReaction);brake=Math.max(brake,Math.abs(witness.brake));
      }
      // Conservative analytic bounds supplement the diagnostic samples. For a
      // fixed-orientation cubic translation N is affine in progress. During
      // release a rises monotonically until detachment (u < .2), B >= 0 adds
      // downward load, and free rolling has constant acceleration thereafter.
      if(phase==='carry'){
        const m=this.station.mechanism;
        if('travel' in m&&typeof m.travel!=='number'){
          mechanismMatrix(m,this.station.anchor,0,this.witnessMatrix);this.witnessNormal.setFromMatrixColumn(this.witnessMatrix,1);
          minimumNormal=spec.marbleMass*(9.81*this.witnessNormal.y-Math.abs(6/this.carrySeconds**2*this.witnessScratch.set(...m.travel).dot(this.witnessNormal)));
          ratio=0;head=0;
        }
      }else if(phase==='release'){
        assertContact(stop,phase,'unsupported-contact-geometry',this.detachTime/this.opening.duration,.2);
        minimumNormal=spec.marbleMass*9.81*this.station.exit.normal[1];
        ratio=.4*spec.marbleMass*this.acceleration/minimumNormal;head=0;
        assertContact(stop,phase,'floor-cone',ratio,VILLAGE_CONTACT.mu);
      }
      if(minimumNormal<=0)throw new VillageAdmissibilityError(stop,phase,'support-normal',Number.EPSILON,minimumNormal);
      const gate=phase==='release'?this.opening:phase==='capture-and-closure'?this.closing:undefined;
      entries.push(Object.freeze({stop,phase,start,end,gate:gate?Object.freeze({duration:gate.duration,binding:gate.binding,envelope:gate.envelope,ledger:gate.ledger}):undefined,minimumNormal,maximumFrictionRatio:ratio,minimumHeadReaction:head,maximumBrake:brake,work:Object.freeze(work),sphereEnergy:sphereEnergy?Object.freeze(sphereEnergy):undefined}));
    };
    const zero={gravity:0,brake:0,slip:0,impact:0,drive:0};
    if(this.capture){
      const w=this.capture.work;record('capture-and-closure',this.start,this.carryStart,{gravity:w.gravity,brake:w.brake,slip:w.slip,impact:w.impact,drive:this.gateEnergy});
      for(let i=0;i<=600;i++){const u=i/600,angle=Math.PI/2*(1-villageEase(u));
        const separation=Math.sqrt(.68**2+.34**2-2*.68*.34*Math.cos(angle));
        assertContact(stop,'closure','stroke',.34,separation);
      }
    }
    record('carry',this.carryStart,this.carryEnd,this.auditedCarryWork??{...zero,drive:this.carryEnergy});
    if(!this.station.retainAtEnd){
      const gt=-9.81*this.station.exit.tangent[1];
      const barWork=.5*spec.marbleMass*1.4*this.detachSpeed**2-spec.marbleMass*gt*this.detachDistance;
      // The lifting front contact removes energy from the sphere; it is not an
      // unbacked kick. Returned work is dissipated by the gate governor.
      assertContact(stop,'release','energy-balance',barWork,0);
      const gravity=spec.marbleMass*gt*Math.abs(carrierEdges(this.station.mechanism)[1]-this.retainedX),kineticChange=.5*spec.marbleMass*1.4*this.exitSpeed**2;
      const residual=gravity+barWork-kineticChange;
      assertContact(stop,'release','energy-balance',Math.abs(residual),128*Number.EPSILON*Math.max(1,kineticChange));
      record('release',this.carryEnd,this.end,{...zero,gravity,drive:this.gateEnergy},{gravity,barWork,kineticChange,residual});
    }
    return Object.freeze(entries);
  }
  relativeAngle(seconds:number):number {
    if(this.capture&&seconds<this.carryStart){this.capture.sample(seconds-this.start);return this.inputDirection*this.capture.angle;}
    let angle=0;if(this.capture){this.capture.sample(this.capture.settledAt);angle=this.inputDirection*this.capture.angle;}
    if(seconds>this.carryEnd&&!this.station.retainAtEnd){this.state(seconds,this.pose);angle+=(this.pose.localX-this.retainedX)/.3;}
    return angle;
  }
  private readonly releaseSample:ReleaseState={distance:0,speed:0,acceleration:0,lift:0,headReaction:0,assist:0};
  private releaseConstraint(seconds:number):ReleaseState {
    if(this.opening.axis.kind!=='lift')throw new Error('Opening axis must lift');
    releaseGeometry(seconds,this.opening.duration,this.opening.axis,this.releaseSample);return this.releaseSample;
  }

  state(seconds: number, target: RetainedPose): void {
    const spec = this.station.retention!, t = Math.max(this.start, Math.min(this.end, seconds));
    target.progress = Math.max(0, Math.min(1, (t - this.carryStart) / this.carrySeconds));
    target.localX = this.retainedX; target.forkX = this.retainedX + this.inputDirection * FORK_RADIUS;
    target.forkLift = 0; if(this.inventory.layout==='keyed-prismatic')target.headLift=0;else if('headLift'in target)delete target.headLift; target.forkAngle = 0;
    let spent = 0;
    if (this.capture && t < this.start + this.capture.centreStop) {
      this.capture.sample(t - this.start);
      target.localX = spec.captureStart + this.inputDirection * this.capture.distance;
      target.forkX = target.localX + this.inputDirection * FORK_RADIUS;
      target.forkAngle = -this.inputDirection * Math.PI / 2;
    } else if (t < this.carryStart) {
      const phase = villageEase((t - this.closureStart) / this.closing!.duration);
      target.forkAngle = -this.inputDirection * Math.PI / 2 * (1 - phase); spent = this.gateEnergy * phase;
    } else {
      spent = (this.station.initialCargo ? 0 : this.gateEnergy) + this.carryEnergy * villageEase(target.progress);
      if (t >= this.carryEnd && !this.station.retainAtEnd) {
        const dt = t - this.carryEnd, phase = villageEase(dt / this.opening.duration);
        if(this.inventory.layout==='keyed-prismatic')target.headLift=GATE_LIFT*phase;
        target.forkLift = this.inventory.layout==='keyed-prismatic'?0:GATE_LIFT * phase; spent += this.gateEnergy * phase;
        const lift = GATE_LIFT * villageEase(dt / this.opening.duration);
        const distance = dt <= this.detachTime ? .3 - Math.sqrt(.3 ** 2 - lift ** 2)
          : this.detachDistance + this.detachSpeed * (dt - this.detachTime) + .5 * this.acceleration * (dt - this.detachTime) ** 2;
        target.localX += this.outputDirection * distance;
      }
    }
    target.weightDrop = spent / (spec.weightMass * 9.81);
  }
  private samplePoint(seconds: number, target: Vector3, normal?: Vector3): void {
    this.state(seconds, this.pose);
    mechanismMatrix(this.station.mechanism, this.station.anchor, this.pose.progress, this.matrix);
    target.set(this.pose.localX, 0, 0).applyMatrix4(this.matrix);
    normal?.set(0, 1, 0).transformDirection(this.matrix);
  }
  sample(seconds: number, target: Vector3, normal?: Vector3): void {
    this.samplePoint(seconds, target, normal);
    const at = Math.max(0, Math.min(this.end - this.start, seconds - this.start)) * 240, index = Math.floor(at);
    const a = this.distances[index]!, b = this.distances[Math.min(index + 1, this.distances.length - 1)]!;
    this.distance = a + (b - a) * ((at - index) / Math.min(1, (this.end - this.start) * 240 - index || 1));
  }
  get length(): number { return this.distances[this.distances.length - 1]!; }
}

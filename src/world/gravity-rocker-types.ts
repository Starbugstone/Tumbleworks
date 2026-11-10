// Proposed public contract; no tripX in this discriminant.
import type {LeverState,LeverRow} from './village-gravity-roll';
import type {RockerAssembly,GravityRate} from './village-gravity-kernel';
export interface GravityRockerSpec {
 readonly kind:'contact-gravity-rocker';readonly marbleMass:number;readonly bodyMass:number;
 /** CENTRAL material/effective-total inertia, unlike legacy bodyInertia (hinge). */
 readonly centralInertia:number;readonly bodyCentre:readonly[number,number,number];
 readonly bearingTorque:number;readonly restitution:0;readonly traction:number;
 readonly homeSeat:Readonly<{lever:number}>;readonly dockSeat:Readonly<{lever:number}>;
 readonly tripX?:never;readonly bodyInertia?:never;
}
export type RockerPhase='home-roll'|'stroke'|'dock-roll'|'return'|'home-rest';
export interface RockerRow extends LeverRow {readonly phase:RockerPhase;readonly rate:GravityRate}
export interface ReturnRow {readonly time:number;readonly angle:number;readonly angularVelocity:number;readonly angularAcceleration:number;readonly energy:number}
export interface RockerContactEvent {readonly kind:'release'|'dock'|'exit';readonly time:number;readonly bracket:readonly[number,number];readonly before:LeverState;readonly after:LeverState;readonly seatImpulse:number;readonly angularImpulse:number;readonly floorNormalImpulse:number;readonly floorTangentImpulse:number;readonly loss:number}
export interface RockerHomeEvent {readonly kind:'home';readonly time:number;readonly bracket:readonly[number,number];readonly before:ReturnRow;readonly after:ReturnRow;readonly seatImpulse:number;readonly angularImpulse:number;readonly floorNormalImpulse:0;readonly floorTangentImpulse:0;readonly loss:number}
export type RockerEvent=RockerContactEvent|RockerHomeEvent;
export interface RockerError {time:number;x:number;velocity:number;angle:number;angularVelocity:number;energy:number;normal:number;cone:number;seat:number}
export interface RockerPolicy {readonly step:number;readonly maxHalvings:number;readonly maxWork:number;readonly state:number;readonly time:number;readonly energy:number}
/** Proposed fixed computational targets, NOT measured bounds or guard epsilons. */
export const ROCKER_NUMERICS:RockerPolicy=Object.freeze({step:1/480,maxHalvings:12,maxWork:200000,state:1e-8,time:1e-9,energy:1e-10});
export interface RockerReport {readonly kind:'observed-convergence';readonly rigorous:false;readonly halvings:number;readonly work:number;readonly comparisons:number;readonly error:RockerError;readonly eventErrors:readonly number[];readonly domain:'planar-flat-home-negative-stroke-positive-return';readonly unresolved:'RK4/local and common-time observations are estimates, not global certificates'}
export interface RockerSolution {readonly assembly:RockerAssembly;readonly spec:GravityRockerSpec;readonly hingeInertia:number;readonly rows:readonly RockerRow[];readonly returnRows:readonly ReturnRow[];readonly events:readonly RockerEvent[];readonly end:number;readonly actorEnd:number;readonly exitSpeed:number;readonly initialEnergy:number;readonly stopLoss:number;readonly stopNormalImpulse:number;readonly stopTangentialImpulse:number;readonly homeLoss:number;readonly report:RockerReport}

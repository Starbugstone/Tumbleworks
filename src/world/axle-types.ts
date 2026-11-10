// Mill111 selected axle implementation. Intended installation: src/world/axle-types.ts.
import type {BufferGeometry,Matrix4,Mesh,Scene} from 'three';
import type{VillageMachine}from'../view/village-machine';
import type{AxleDrawBinding}from'../view/axle-draw';
import type{VillageAxle}from'./village-axle';
import type {VillageStation,VillageVec3} from './village-plan';
import {VillageAdmissibilityError} from './village-contact';
export interface AxleCarrySpec {
  readonly kind: 'axle-carry';
  readonly catch: { readonly kind: 'head-only' };                    // D-W1; no gated variant exists in this type
  readonly pin: readonly [number, number];                           // carrier-local, marble-centre origin: (-.3, 0)
  readonly tilt: { readonly profile: 'late-cubic-smoothstep'; readonly window: number; readonly exitPitch: number }; // .25, +.18
  /** Exactly one follower. angle is derived, not data: arg f = (pi + h_max)/2 + p1 - pi/2 is asserted. */
  readonly follower: { readonly length: number; readonly radius: number; readonly facets: 8; readonly z: readonly [number, number] }; // .40, .03, [-4.075,-3.95]
  readonly cam: {
    readonly plate: readonly [number, number];                       // [-4.08,-4.02]
    readonly wallBand: number;                                       // .05 material outside each wall
    readonly extension: number;                                      // .05 rad of frozen-beta circle beyond each dock
    readonly wallIntervals: number;                                  // 24, equal tangent turning, plus splits at q_f and the inflection
    readonly model: 'nominal-analytic-cam-106';                      // D-106-1; any other value rejects 'antirotation'
  };
  readonly rotor: {
    readonly declaredAxleInertia: 'retention.rotorInertia';          // the SAME .024; no second literal exists
    readonly plane: readonly [number, number];                       // ring faces [-3.86,-3.80]
    readonly ring: { readonly inner: number; readonly outer: number; readonly segments: 24 };
    readonly hub: { readonly radius: number; readonly z: readonly [number, number] };   // .12, [-3.90,-3.76]
    readonly boss: { readonly outer: number; readonly bore: number; readonly z: readonly [number, number] }; // .06, .025
    readonly axle: { readonly radius: number; readonly z: readonly [number, number] };  // .03, [-5.57,-3.75]
  };
  readonly journals: readonly [{ readonly id: 'J1a'; readonly z: number }, { readonly id: 'J1b'; readonly z: number }]; // -4.40, -5.50
  readonly spool: { readonly pitch: number; readonly drum: readonly [number, number]; readonly flange: number; readonly segments: 12 }; // .17, [-5.01,-4.89], .21
  readonly line: { readonly halfWidth: number; readonly wrapMargin: number; readonly render: 'variable-span-wrap'; readonly segments: 32; readonly sides: 4 }; // .0175, pi/4; root108 changes the actual line topology.
  readonly source: { readonly top: number; readonly declaredDrop: 'retention.weightDrop' }; //2.45; no .62 presentation-derived physical limit.
  readonly weight: { readonly size: VillageVec3; readonly guideOffsetZ: number }; // [.38,.70,.38], -.12
  readonly caliper: { readonly angle: number; readonly patch: { readonly inner: number; readonly outer: number; readonly halfAngle: number } }; // 4pi/3, 2.065, 2.115, .012
  readonly dock: {
    readonly caps: readonly [{ readonly on: 'connector'; readonly x: number }, { readonly on: 'stop-5'; readonly x: number }]; // -.40, -1.90
    readonly girderTop: number;                                      // 3.93
    readonly path: readonly (readonly [number, number])[];           // A..E plan points, x/z
  };
  readonly feet: readonly ('trestle-a' | 'trestle-b' | 'caliper-post' | 'guide-rod')[]; // D-106-2 named anchors only
}


export type AxleStation=VillageStation&{readonly retention:NonNullable<VillageStation['retention']>;readonly mechanism:Extract<VillageStation['mechanism'],{kind:'wheelbucket'}>&{readonly axleCarry:AxleCarrySpec}};
export type V=readonly[number,number,number];
export type Tensor=readonly[number,number,number,number,number,number,number,number,number];
export type Body='rotor'|'carrier'|'capture-head'|'weight'|'line'|'static';
export interface Part {readonly id:string;readonly body:Body;readonly frame:'rotor-rest'|'carrier-local'|'head-local'|'weight-rest'|'guide-local'|'world';readonly render:BufferGeometry;readonly solid:BufferGeometry;readonly closure?:{readonly renderTriangles:number;readonly caps:readonly number[]};readonly nominal:Readonly<Record<string,number|string>>}
export interface Mass {readonly body:Exclude<Body,'static'|'line'>;readonly mass:number;readonly centre:V;readonly central:Tensor;readonly parts:readonly string[]}
export interface Inventory {readonly model:'disjoint-composite-part-volumes';readonly caliperArm:number;readonly caliperSite:V;readonly caliperFaces:readonly[number,number];readonly headGuide:{readonly x0:number;readonly x1:number;readonly y0:number;readonly y1:number;readonly z0:number;readonly z1:number;readonly opening:number};readonly weightGuide:{readonly x0:number;readonly x1:number;readonly z0:number;readonly z1:number};readonly carrier:Mass;readonly head:Mass;readonly rotor:Mass;readonly weight:Mass;readonly rotorAxleInertia:number;readonly marble:{readonly mass:number;readonly radius:number;readonly inertia:number};readonly unbuilt:readonly[{readonly part:'fork';readonly mass:number}]}
export interface Q {q:number;qd:number;qdd:number;phi:number;b:number;bp:number}
export interface Row extends Q {acc:number;spinRate:number;ax:number;ay:number;slipSpeed:number;slipPower:number;exchangePower:number;slipSign:number;time:number;s:number;v:number;omega:number;relative:number;governorWork:number;slipWork:number;exchange:number;phase:'attached'|'roll'|'slip'|'fixed-roll'|'fixed-slip';normal:number;friction:number;head:number;governor:number;tension:number;}
export interface Event {readonly kind:'flip'|'leave-head'|'slip'|'roll'|'carry-end'|'seam';readonly time:number;readonly bracket:readonly[number,number];readonly left:Row;readonly right:Row;readonly conditioning:number}
export interface Wrench {readonly part:string;readonly body:Body;readonly kind:'force'|'impulse';readonly time:number;readonly at:V;readonly force:V;readonly moment:V;readonly frame:'world';readonly work:number}
export interface GroundFace {readonly a:V;readonly b:V;readonly c:V;readonly kind:'land';readonly provider:object;readonly face:number}
export type Hole='cam-whole-cell-construction'|'drum-line-whole-cell-containment'|'native-foot-land'|'finite-joint-welds'|'numerical-event-observer'|'all-foreign-motion'|'range-stores-and-bounds';
export interface NativePart {readonly id:string;readonly body:Body;readonly mesh:object;readonly geometry:BufferGeometry;readonly first:number;readonly count:number;readonly toWorld:Matrix4}
export interface NativeInput {readonly parts:readonly NativePart[];readonly land:Mesh;readonly sceneRoot:Scene;readonly canonical:readonly Part[];readonly model:VillageAxle;readonly binding:AxleDrawBinding;readonly machine:VillageMachine}
export interface NumericalObservation {readonly rigorous:false;readonly halvings:number;readonly work:number;readonly state:Readonly<Record<'s'|'v'|'omega'|'relative'|'work',number>>;readonly eventTime:number;readonly energy:number;readonly conditioning:number;readonly unresolved:readonly Hole[]}
export interface AxleLedger {readonly phase:string;readonly start:number;readonly end:number;readonly source:number;readonly potentialChange:number;readonly kineticStart:number;readonly kineticEnd:number;readonly governor:number;readonly slip:number;readonly marbleExchange:number;readonly poseOracleResidual:number;readonly unusedSuspendedEnergy:number;readonly numerical:NumericalObservation}
export const AXLE_POLICY=Object.freeze({step:1/480,maxHalvings:12,maxWork:200000,state:1e-8,energy:1e-10,time:1e-9});
export class AxleReject extends VillageAdmissibilityError {constructor(stop:number,readonly blocker:string,phase:string,required:number,available:number,detail=''){super(stop,'axle-'+phase,blocker==='line-tension'?'line-tension':blocker==='governor-capacity'?'governor-capacity':blocker==='drive-force'?'drive-force':'unsupported-contact-geometry',required,available,JSON.stringify({blocker,detail}));}}
export function reject(s:AxleStation,blocker:string,detail:string,required=1,available=0):never{throw new AxleReject(s.stop,blocker,'compile',required,available,detail);}

export class AxleWork {used=0;phase='domain';readonly counts:Record<string,number>={};constructor(readonly s:AxleStation){}tick(n=1){this.counts[this.phase]=(this.counts[this.phase]??0)+n;if((this.used+=n)>AXLE_POLICY.maxWork)reject(this.s,'numerical-indeterminate',JSON.stringify({reason:'Unchanged combined numerical work cap',phase:this.phase,counts:this.counts}),this.used,AXLE_POLICY.maxWork);}}

export interface AxleApproach {readonly start:number;readonly end:number;readonly incomingSpeed:number}

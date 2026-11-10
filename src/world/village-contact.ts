import type{AxleLedger}from'./axle-types';
import type {NumericalReport,ArcReport,PlanarImpactResult} from './pendulum-types';
/** Declared game contact law, not a measured material coefficient. */
export interface SphereBody { readonly mass:number; readonly radius:number; readonly centralInertia:number }
export interface CoulombContact { readonly kind:'coulomb-single'; readonly mu:number }
export interface FrictionlessUnilateralHead { readonly kind:'frictionless-unilateral'; readonly restitution:0 }
export const VILLAGE_CONTACT: CoulombContact = Object.freeze({kind:'coulomb-single',mu:.8});
export const VILLAGE_HEAD: FrictionlessUnilateralHead = Object.freeze({kind:'frictionless-unilateral',restitution:0});
export type AdmissibilityCheck='floor-cone'|'impact-cone'|'support-normal'|'head-compressive'|'brake-bound'|'hold-bound'|'stroke'|'energy-balance'|'unsupported-contact-geometry'|'drive-force'|'governor-capacity'|'line-tension';
export class VillageAdmissibilityError extends Error {
  constructor(readonly stop:number,readonly phase:string,readonly check:AdmissibilityCheck,readonly required:number,readonly available:number,readonly detail?:string){
    super(`Stop ${stop} ${phase} ${check}: ${required} > ${available}${detail ? ` (${detail})` : ''}`);this.name='VillageAdmissibilityError';
  }
}
export interface VillageWork { readonly gravity:number;readonly brake:number;readonly slip:number;readonly impact:number;readonly drive:number }
/** Aggregate bounds, NEVER an instantaneous per-bar contact allocation. */
export interface VillageLedgerEntry {
  readonly axle?:Readonly<AxleLedger>;
  readonly axleDock?:Readonly<{dock:'home'|'top';ownership:string;site:readonly[number,number,number];force:readonly[number,number,number];moment:readonly[number,number,number];holds:readonly number[];representedImpulse:readonly[0,0,0];model:string;time:number}>;
  readonly rocker?:Readonly<{bodyMass:number;centralInertia:number;hingeInertia:number;energyResidual:number;event?:import('./gravity-rocker-types').RockerEvent;numerical?:import('./gravity-rocker-types').RockerReport}>;
  readonly stop:number;readonly phase:string;readonly start:number;readonly end:number;
  readonly minimumNormal:number;readonly maximumFrictionRatio:number;readonly minimumHeadReaction:number;readonly maximumBrake:number;
  /** Source allocation / dissipation; see sphereEnergy for the release identity. */
  readonly gate?:Readonly<{duration:number;binding:string;envelope:Readonly<{minimumGovernor:number;maximumGovernor:number;minimumLineTension:number}>;ledger:Readonly<{source:number;potential:number;sphere:number;governor:number;residual:number;peakSourceKinetic:number}>}>;
  readonly work:VillageWork;
  readonly sphereEnergy?:Readonly<{gravity:number;barWork:number;kineticChange:number;residual:number}>;
  /** Pendulum-only publication; angular impulses are N m s, work is joules.
   * Computational estimates are separate from closed identities. */
  readonly strike?:Readonly<{episode?:number;impact?:PlanarImpactResult;potentialChange:number;partnerKineticChange:number;bearingWork:number;energyResidual:number;angularImpulse?:number;normalImpulse?:number;reaction?:number;capacity?:number;stopReaction?:0;numerical?:NumericalReport|ArcReport}>;
}
/** Exact phase witness in carrier local axes; zero-load closed touch is explicit. */
export interface VillageContactWitness {
  phase:string;floorNormal:number;floorFriction:number;leadingReaction:number;trailingReaction:number;brake:number;
}
export function assertContact(stop:number,phase:string,check:AdmissibilityCheck,required:number,available:number):void {
  if(!Number.isFinite(required)||!Number.isFinite(available)||required>available+64*Number.EPSILON*Math.max(1,Math.abs(required),Math.abs(available)))
    throw new VillageAdmissibilityError(stop,phase,check,required,available);
}

/** Reject the old instantaneous rolling constraint independently of its energy. */
export function assertTangentImpact(stop:number,mass:number,kappa:number,before:number,after:number,normalImpulse:number,mu:number):void {
  assertContact(stop,'impact','impact-cone',Math.abs(mass*kappa*(before-after)),mu*normalImpulse);
}

/** A rotating regular polygon is not an axisymmetric head. At half a facet its
 * support plane recedes while the prescribed sphere centre remains fixed.
 * A positive holding reaction cannot cross that gap. This is geometry, not mu.
 */
export function assertRotatingHeadClosure(stop:number,radius:number,sides:number,requiredHeadLoad:number):void {
  if(requiredHeadLoad>0)throw new VillageAdmissibilityError(stop,'fork-closure','unsupported-contact-geometry',radius*(1-Math.cos(Math.PI/sides)),0,
    'Rotating faceted head separates from the stationary sphere while a positive holding reaction is required');
}

/** Necessary right-hand work/force bound at a zero-speed lift start. Other
 * lifted masses and falling-source inertia are omitted, so passing this bound
 * is not a complete drive proof. A constraint reaction cannot supply work. */
export function assertHeadReleaseDrive(stop:number,headMass:number,liftAcceleration:number,normalGravity:number,gateEnergy:number,lift:number):void {
  assertContact(stop,'retained-release-drive','drive-force',headMass*(liftAcceleration+normalGravity),gateEnergy/lift);
}

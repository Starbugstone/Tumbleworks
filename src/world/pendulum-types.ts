import type { VillageVec3 } from './village-plan';
import type { FootingPatch } from './pendulum-support';
export interface PendulumDrive {
 readonly kind:'pendulum';readonly mass:number;
 /** Unchanged legacy inputs; friction is a generalized force on legacy metres. */
 readonly legacyGuideWork:Readonly<{friction:number;stroke:number}>;
 readonly axle:Readonly<{origin:VillageVec3;axis:VillageVec3}>;
 readonly bar:Readonly<{arm:number;radius:number;length:number;facets:16}>;
 readonly footings:readonly FootingPatch[];
 readonly stopAngle:number;readonly dress:'harbour-bell'|'mill-paddle'|'clock-bell'|'cloud-gong';
}
export interface LegacyStrikerDrive {readonly kind?:'legacy';readonly mass:number;readonly inertia:number;readonly friction:number;readonly stroke:number}
export type StrikerDrive=LegacyStrikerDrive|PendulumDrive;
export function legacyBearingWork(d:PendulumDrive):number{return d.legacyGuideWork.friction*d.legacyGuideWork.stroke;}
export function bearingTorque(d:PendulumDrive):number{
 if(!(d.stopAngle>0&&d.legacyGuideWork.friction>=0&&d.legacyGuideWork.stroke>0))throw new Error('Invalid pendulum legacy work');
 return legacyBearingWork(d)/d.stopAngle;
}
export interface BarContact {
 feature:number;kind:'edge'|'vertex';x:number;first:number;second:number;
 nx:number;ny:number;J:number;margin:number;
}
export const blankBarContact=():BarContact=>({feature:0,kind:'edge',x:0,first:0,second:0,nx:0,ny:0,J:0,margin:0});
export interface PendulumState {q:number;u:number;w:number;angle:number;slipWork:number;contactWork:number}
export interface PendulumRate extends PendulumState {lambda:number;normal:number;friction:number;acceleration:number;slip:number}
export interface StateEstimates {readonly q:number;readonly time:number;readonly u:number;readonly w:number;readonly angle:number;readonly slipWork:number;readonly contactWork:number}
export const NUMERICAL_UNITS=Object.freeze({q:'rad',time:'s',u:'rad/s',w:'m/s',angle:'rad',slipWork:'J',contactWork:'J'} as const);
export interface NumericalPolicy {
 readonly initialStep:number;readonly maxHalvings:number;readonly maxSteps:number;
 readonly stateTargets:StateEstimates;readonly absoluteEnergyEstimate:number;readonly eventTimeEstimate:number;
}
/** Fixed computational targets; none is a physical guard tolerance. */
export const PROPOSED_NUMERICS:NumericalPolicy=Object.freeze({initialStep:1/480,maxHalvings:12,maxSteps:200000,stateTargets:Object.freeze({q:1e-8,time:1e-8,u:1e-8,w:1e-8,angle:1e-8,slipWork:1e-8,contactWork:1e-8}),absoluteEnergyEstimate:1e-10,eventTimeEstimate:1e-9});
export interface NumericalObservations {readonly lambda:number;readonly normal:number;readonly friction:number;readonly cone:number;readonly spin:number;readonly x:number;readonly speed:number;readonly energy:number;readonly time:number;readonly eventQ:number;readonly eventTime:number}
export interface NumericalReport {
 readonly termination:'observed-order'|'roundoff-plateau';readonly roundoff:StateEstimates;
 readonly status:'observed-convergence-estimate';readonly step:number;readonly halvings:number;
 readonly differences:StateEstimates;readonly estimates:StateEstimates;readonly localEstimates:StateEstimates;
 readonly orderRatio:number;readonly normalizedDifference:number;
 readonly observations:NumericalObservations;
 readonly regimeEvents:readonly Readonly<{qDifference:number;timeDifference:number;spinDifference:number;leftFriction:number;rightFriction:number}>[];
 readonly margins:Readonly<{lambda:number;normal:number;rollingCone:number}>;
 readonly energyResidual:number;readonly eventBracket:readonly[number,number];
 /** Observations and Richardson estimates are not rigorous enclosures. */
 readonly rigorous:false;
}

export interface ArcReport {readonly status:'observed-convergence-estimate';readonly panels:number;readonly differenceSeconds:number;readonly referenceDifferenceSeconds:number;readonly interpolation:Readonly<{q:number;u:number}>;readonly rigorous:false}
export interface PendulumRest {
 readonly kind:'bell-hold'|'return-stick';readonly q:number;readonly time:number;readonly gravitySlope:number;readonly capacity:number;readonly margin:number;
 readonly work:0;readonly stopReaction:0;readonly site:'axle-bearing';readonly returnBearingWork:number;readonly potentialDrop:number;
}
export interface PendulumSettle {
 readonly bell:Readonly<{time:number;speed:number;impulse:number;loss:number;restitution:0}>;
 readonly rest:PendulumRest;readonly rows:Float64Array;readonly report?:ArcReport;
 readonly certificate:Readonly<{minimumCurvature:number;leavesBell:boolean;cannotReachRest:number;qStar:number;delta:number;rootBracket:readonly[number,number];rootResidual:number}>;
}

/** UNUSED recontact49 candidate; computational errors have declared units and
 * remain estimates. They do not enlarge a physical cone or close a gap. */
export interface StrikeError {
 readonly q:number;readonly time:number;readonly x:number;readonly v:number;readonly u:number;readonly w:number;readonly angle:number;
 readonly energy:number;readonly lambda:number;readonly normal:number;readonly friction:number;
}
export interface StrikeState {readonly q:number;readonly time:number;readonly x:number;readonly v:number;readonly u:number;readonly w:number;readonly angle:number;readonly floor:'roll'|'slip';readonly error:StrikeError}
export interface EventBracket {readonly id:string;readonly q:readonly[number,number];readonly time:readonly[number,number]}
export interface FeatureCell {readonly index:number;readonly feature:number;readonly kind:'edge'|'vertex';readonly q0:number;readonly q1:number;readonly start:readonly[number,number];readonly end:readonly[number,number]}
export interface FeaturePartition {readonly cells:readonly FeatureCell[];readonly clear:readonly[number,number]|undefined;readonly stop:number;readonly topology:string}
export interface ImpactUncertainty {readonly gamma:number;readonly slip:number;readonly coneSlope:number;readonly impulse:number}
export interface PlanarImpactInput {readonly q:number;readonly nx:number;readonly ny:number;readonly first:number;readonly v:number;readonly w:number;readonly u:number;readonly floor:'roll'|'slip';readonly uncertainty:ImpactUncertainty}
export type ImpactBranch='frictionless'|'stick'|'slip-back'|'slip-forward'|'slip-then-stick'|'slip-then-back';
export interface RouthSegment {readonly kind:'frictionless'|'stick'|'slip';readonly sign:-1|0|1;readonly dP:number;readonly dF:number;readonly gammaA:number;readonly gammaB:number;readonly slipA:number;readonly slipB:number;readonly normalLoss:number;readonly frictionLoss:number}
export interface PlanarImpactResult {
 readonly gammaBefore:number;readonly gammaAfter:number;readonly normalImpulse:number;readonly floorNormalImpulse:number;readonly floorTangentImpulse:number;
 readonly branch:ImpactBranch;readonly coneMargin:number;readonly vAfter:number;readonly wAfter:number;readonly uAfter:number;
 readonly hammerAngularImpulse:number;readonly barImpulse:readonly[number,number];readonly loss:number;readonly normalLoss:number;readonly frictionLoss:number;readonly residual:number;
 readonly segments:readonly RouthSegment[];
}
export interface ContactStart {readonly state:StrikeState;readonly cell:number;readonly mode:import('./pendulum-core').StrikeMode;readonly bracket:EventBracket;readonly exitX:number}
export interface ContactExit {readonly kind:'separation-root'|'separation-feature'|'clear';readonly state:StrikeState;readonly cell:number;readonly bracket:EventBracket;readonly lambdaLeft:number;readonly lambdaRight:number;readonly error:number}
export interface ContactResult {readonly rows:readonly import('./pendulum-integrate').PushRow[];readonly start:ContactStart;readonly exit:ContactExit;readonly report:NumericalReport;readonly steps:number;readonly events:readonly EventBracket[]}
export interface MarbleFree {readonly time:number;readonly x:number;readonly v:number;readonly w:number;readonly angle:number;readonly floor:'roll'|'slip'}
export interface FreeReport extends ArcReport {
 readonly topology:readonly string[];readonly stableRefinements:number;readonly localTimeEstimate:number;readonly state:StrikeError;
 readonly grazing?:Readonly<{kind:'cubic-gap'|'quadratic-gap';derivativeLower:number;quinticRelativeRemainder:number;roundingModel:string}>;
 readonly coverage?:Readonly<{intervals:number;positive:number;monotone:number}>;
 readonly launch?:Readonly<{lambdaLeft:number;lambdaRight:number;loadEstimate:number;bracketSeconds:number;secondDerivative:number;secondDerivativeEstimate:number;timeEstimate:number;ownership:string}>;
 readonly rootConditioning?:Readonly<{gamma:number;gammaEstimate:number;factor:number;q:number;time:number;gapResidual:number;quadratureEstimate:number}>;
}
export interface FreeResult {readonly start:StrikeState;readonly end:StrikeState;readonly exit:'reimpact'|'bell';readonly cell:number|undefined;readonly bracket:EventBracket;readonly rows:Float64Array;readonly marble:MarbleFree;readonly report:FreeReport;readonly slipLoss:number;readonly minimumGap:number;readonly partnerEnd:Readonly<{q:number;time:number;u:number}>;readonly marbleExit:MarbleExit;readonly checkedUntil:number}
export type StrikeEpisode=
 | Readonly<{kind:'impact';index:number;state:StrikeState;before:StrikeState;cell:number;result:PlanarImpactResult;bracket:EventBracket}>
 | Readonly<{kind:'contact';index:number;start:number;end:number;motion:ContactResult}>
 | Readonly<{kind:'free';index:number;start:number;end:number;motion:FreeResult}>;
export interface StrikeEpisodes {
 readonly partition:FeaturePartition;readonly episodes:readonly StrikeEpisode[];readonly initial:StrikeState;readonly atBell:Readonly<{q:number;time:number;u:number;error:StrikeError}>;readonly marbleExit:MarbleExit;
 readonly finalSeparation:number;readonly forwardBearingWork:number;readonly steps:number;readonly topology:readonly string[];
}

export interface ForwardBudget {readonly used:number;use(count:number,phase:string):void}
export interface SeparationStart {readonly kind:'root'|'jump';readonly bracket:EventBracket;readonly lambdaLeft:number;readonly lambdaRight:number;readonly uncertainty:number}

/** Sphere-only deck handoff. It intentionally has no fabricated partner q/u. */
export interface MarbleExit {readonly time:number;readonly x:number;readonly v:number;readonly w:number;readonly angle:number;readonly floor:'roll'|'slip';readonly error:StrikeError}

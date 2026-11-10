import type {AxleCarrySpec} from './axle-types';
import type { StrikerDrive } from './pendulum-types';
import type{GravityRockerSpec}from'./gravity-rocker-types';
import type { GravityLeverSpec } from './village-gravity-roll';
/** Authored world coordinates; y is up. Ports describe marble centres. */
export type VillageVec3 = readonly [number, number, number];
export interface VillagePort {
  readonly position: VillageVec3;
  readonly tangent: VillageVec3;
  readonly normal: VillageVec3;
  readonly width: number;
}
export type VillageMechanism =
  | { readonly kind: 'release' | 'translating' | 'suspended'; readonly travel: VillageVec3; readonly deckPitch?: number; readonly localContact?: VillageVec3 }
  | { readonly kind: 'channel' | 'arc' | 'helix' | 'loop' | 'bowl'; readonly points: readonly VillagePort[] }
  | { readonly kind: 'tipping' | 'bridge' | 'turntable' | 'launcher'; readonly pivot: VillageVec3; readonly axis: VillageVec3; readonly angle: number; readonly localContact?: VillageVec3; readonly deckPitch?: number; readonly dockingLift?: number }
  | { readonly kind: 'wheelbucket'; readonly axleCarry?:AxleCarrySpec; readonly radius: number; readonly angle: number; readonly localContact?: VillageVec3; readonly deckPitch?: number }
  | { readonly kind: 'escapement'; readonly travel: number; readonly pitch?: number;
      readonly drive?: { readonly marbleMass: number; readonly rotorEnergy: number; readonly rotorInertia: number;
        readonly dragTorque: number; readonly gateMass: number; readonly gateLift: number; readonly riseAngle: number } }
  | { readonly kind: 'striker' | 'receiver'; readonly travel: number };
/** Static mesh metadata only; all indices refer to the ORIGINAL authored frames. */
export interface VillageChannelLip {
  readonly side: 'negative' | 'positive';
  readonly minimumHeight: number;
  readonly envelopes: readonly { readonly startFrame: number; readonly fullStartFrame: number; readonly fullEndFrame: number; readonly endFrame: number }[];
}
export interface VillageBearingSeat {readonly support:number;readonly frame:number;readonly joint?:'entry'|'exit'}
export interface VillageStation {
  readonly stop: number;
  readonly anchor: VillageVec3;
  readonly badge: VillageVec3;
  readonly mechanism: VillageMechanism;
  readonly entry: VillagePort;
  readonly exit: VillagePort;
  readonly start: number;
  readonly contact: number;
  readonly end: number;
  readonly color: number;
  readonly channelLip?: VillageChannelLip;
  readonly releasePin?: boolean;
  readonly rollingDrive?: (GravityLeverSpec & { readonly kind: 'contact-gravity' }) | GravityRockerSpec;
  readonly hinge?:'outboard-journal';
  readonly terminalCapture?: { readonly marbleMass: number; readonly headMass: number; readonly brakeForce: number; readonly lead: number; readonly availableStroke: number };
  readonly strikerDrive?: StrikerDrive;
  /** First cradle starts with a real resting load, released by the external cause. */
  readonly initialCargo?: { readonly localX: number };
  readonly retainAtEnd?: boolean;
  readonly retention?: {
    /** Explicit physical topology opt-in; absent preserves the original assembly. */
    readonly opening?: 'captive-leaf';
    readonly marbleMass: number; readonly headMass: number; readonly brakeForce: number;
    readonly captureStart: number; readonly captureStroke: number;
    readonly bodyMass: number;
    /** Local COM of the complete moving body, including a launcher's attached block. */
    readonly bodyCentre?: VillageVec3;
    /** Central inertia about the driven axis; COM translation is counted separately. */
    readonly bodyInertia: number; readonly rotorInertia: number;
    readonly weightMass: number; readonly weightDrop: number;
    readonly acceleration: number; readonly gateSeconds: number; readonly gateMass: number;
  };
  /** World-space top contacts of supports; each x/z must have real terrain. */
  readonly supports?: readonly VillageVec3[];
  /** Indices into this owner's own `supports` (strictly ascending, plank profile only) whose pile
   * meets the drawn terrain over its complete foot: one exact plane gives a planar cap, otherwise
   * the foot is split at every drawn terrain edge it crosses. Absent keeps every flat foot exact. */
  readonly terrainFeet?: readonly number[];
  readonly bearingSeats?: readonly VillageBearingSeat[];
  /** Explicit frame indices pin existing capped posts when a track grows. */
  readonly supportIndices?: readonly number[];
  /** A real supported span replaces automatic intermediate ground posts. */
  readonly span?: 'girder' | 'cable';
  /** Opt-in fixed weight-source mount: the weight axis x relative to the anchor,
   * with its guide grounded as one column under the pulley beam. Absent keeps
   * the original x=1.2 weight, its hung guide and the [-.15, 1.35] beam exactly. */
  readonly sourceMount?: { readonly x: number; readonly guide: 'grounded' };
}
export interface VillageConnector {
  readonly from: number;
  readonly to: number;
  /** Full world-space frames, including exact source and destination frames. */
  readonly points: readonly VillagePort[];
  readonly supports?: readonly VillageVec3[];
  /** Authored capped post frames when quarter-point posts would obstruct another run. */
  readonly supportIndices?: readonly number[];
  /** Subdivide warped floor quads around their true centre contact point. */
  readonly refineFloor?: boolean;
  /** Indices into this owner's own `supports` (strictly ascending, plank profile only) whose pile
   * meets the drawn terrain over its complete foot: one exact plane gives a planar cap, otherwise
   * the foot is split at every drawn terrain edge it crosses. Absent keeps every flat foot exact. */
  readonly terrainFeet?: readonly number[];
  readonly bearingSeats?: readonly VillageBearingSeat[];
  /** Actual automatic support-frame indices, excluding explicit supports. */
  readonly terrainFrameFeet?: readonly number[];
  readonly omitAutomaticFrames?:readonly number[];
  readonly fixedEnds?:readonly('source'|'destination')[];
  readonly span?: 'girder' | 'cable';
}
export interface VillageCameraShot {
  readonly start: number;
  readonly end: number;
  readonly target: VillageVec3;
  readonly yaw: number;
  readonly elevation: number;
  readonly radius: number;
}
export type VillageProfile = 'plank' | 'terracotta' | 'timber' | 'twinrail' | 'girder' | 'steel';
export interface VillagePlan {
  readonly staticSupports?:'harbour-static-112';
  readonly profile: VillageProfile;
  readonly chapter: number;
  readonly stations: readonly VillageStation[];
  readonly connectors: readonly VillageConnector[];
  readonly camera: readonly VillageCameraShot[];
}
export const VILLAGE_RADIUS = 0.3;
export const VILLAGE_WIDTH = 0.8;
export const VILLAGE_DURATION = 25;
export function villagePort(position: VillageVec3, tangent: VillageVec3 = [1, 0, 0], normal: VillageVec3 = [0, 1, 0], width = VILLAGE_WIDTH): VillagePort {
  return { position, tangent, normal, width };
}

/** The automatic connector posts actually built by VillageMachine. */
export function connectorSupportFrames(points: readonly VillagePort[]): readonly number[] {
  return [...new Set([.25,.75].map(f => Math.round((points.length-1)*f)))];
}

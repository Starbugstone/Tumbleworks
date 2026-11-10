import type { Matrix4, Vector3, Quaternion } from "three";
import type {
  VillageContactRecord,
  VillageSegment,
  VillageTimeBoundary,
  VillageTransferInterval,
  VillageHandoff,
} from "./village-program";
import type { VillageProgram } from "./village-program";
import type { VillagePlan } from "./village-plan";

export type VillageAuxiliary =
  | "wheel"
  | "gate"
  | "gear"
  | "top"
  | "striker"
  | "weight"
  | "fork"
  | "capture-head"
  | "head-frame"
  | "damper";
export interface VillageAuxiliaryPose {
  /** Rotation radians around the mover's authored axis. */
  angle: number;
  /** Translation from its authored rest pose. */
  x: number;
  y: number;
  z: number;
}
/** Absolute playback seconds; mode distinguishes authored films from physical research. */
export type VillagePlayback =
  | { readonly state: "ready" }
  | { readonly state: "unavailable"; readonly reason: string };
export type VillageMotionMode = "physical" | "cinematic";
export interface VillageMotionTimeline {
  readonly mode: VillageMotionMode;
  readonly playback: VillagePlayback;
  readonly motionStatus:
    | { readonly state: "ready" }
    | { readonly state: "authoring"; readonly reason: string };
  readonly duration: number;
  readonly plan: VillagePlan;
  readonly authoredPlan: VillagePlan;
  readonly contacts: readonly VillageContactRecord[];
  readonly segments: readonly VillageSegment[];
  readonly boundaries: readonly VillageTimeBoundary[];
  readonly transfers: readonly VillageTransferInterval[];
  readonly handoff: VillageHandoff;
  readonly distance: number;
  requirePhysical(): void;
  sample(seconds: number, target: Vector3): void;
  marbleOrientation(seconds: number, target: Quaternion): void;
  normalAt(seconds: number, target: Vector3): void;
  carrierPose(stop: number, seconds: number, target: Matrix4): void;
  auxiliaryPose(
    stop: number,
    part: VillageAuxiliary,
    seconds: number,
    target: VillageAuxiliaryPose,
  ): void;
}

export interface VillageRotorTransfer {
  readonly contact: number;
  readonly joules: number;
  readonly inertia: number;
  readonly dragTorque: number;
}
/** Finite coast from a resolved energy transfer, with no per-frame allocations. */
export class VillageRotor {
  readonly end: number;
  readonly turns: number;
  private readonly initial: number;
  private readonly deceleration: number;
  constructor(readonly transfer: VillageRotorTransfer) {
    const { contact, joules, inertia, dragTorque } = transfer;
    if (
      ![contact, joules, inertia, dragTorque].every(Number.isFinite) ||
      joules < 0 ||
      inertia <= 0 ||
      dragTorque <= 0
    )
      throw new Error("Invalid rotor transfer");
    this.initial = Math.sqrt((2 * joules) / inertia);
    this.deceleration = dragTorque / inertia;
    this.end = contact + this.initial / this.deceleration;
    this.turns = joules / dragTorque / (2 * Math.PI);
  }
  angle(seconds: number): number {
    if (!Number.isFinite(seconds)) throw new Error("Invalid rotor time");
    const dt = Math.max(0, Math.min(this.end, seconds) - this.transfer.contact);
    return this.initial * dt - 0.5 * this.deceleration * dt * dt;
  }
  speed(seconds: number): number {
    if (!Number.isFinite(seconds)) throw new Error("Invalid rotor time");
    return seconds < this.transfer.contact
      ? 0
      : Math.max(
          0,
          this.initial - this.deceleration * (seconds - this.transfer.contact),
        );
  }
}

export type VillageRoute = VillageMotionTimeline &
  Pick<
    VillageProgram,
    | "focus"
    | "retainedSide"
    | "retainedLayout"
    | "retainedHeadRole"
    | "retainedForkOrigin"
    | "terminalPad"
    | "terminalHeadPose"
    | "hasCompiledRetained"
    | "axleMotion"
  >;

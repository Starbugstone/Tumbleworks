import type { VillageVec3 } from './village-plan';
import { cos, sin } from '../engine/exact-math';

export interface WorkshopSite {
  readonly house: { readonly position: VillageVec3; readonly scale: number; readonly yaw: number };
  readonly badge: VillageVec3;
  readonly door: VillageVec3;
  readonly pivot: VillageVec3;
  readonly connector: { readonly from: number; readonly to: number };
}
export interface WorkshopSignPlacement {
  readonly pivot: { readonly x: number; readonly y: number; readonly z: number };
  readonly yaw: number;
  readonly scale: number;
}

export const WORKSHOP_BADGE = [8.6, 5.2, -0.4] as const;
export const WORKSHOP_DOOR = [7.7, 3.1, -0.1] as const;
export const WORKSHOP_BUILDING = {
  house: { x: 7.7, y: 3.04, z: -1.6, scale: 1.1 },
  badge: { x: 8.6, y: 5.2, z: -0.4 },
  door: { x: 7.7, y: 3.1, z: -0.1 },
  pivot: { x: 6.75, y: 4.75, z: 0.12 },
  radius: 0.3, thickness: 0.06, drop: 0.55,
} as const;

/** Keep the sign and doorstep attached when a plan moves or turns its Workshop. */
export function workshopSite(house: WorkshopSite['house'], badge: VillageVec3, connector: WorkshopSite['connector']): WorkshopSite {
  const scale = house.scale / WORKSHOP_BUILDING.house.scale;
  const transform = (point: { readonly x: number; readonly y: number; readonly z: number }): VillageVec3 => {
    const x = (point.x - WORKSHOP_BUILDING.house.x) * scale;
    const y = (point.y - WORKSHOP_BUILDING.house.y) * scale;
    const z = (point.z - WORKSHOP_BUILDING.house.z) * scale;
    return [house.position[0] + x * cos(house.yaw) + z * sin(house.yaw), house.position[1] + y,
      house.position[2] - x * sin(house.yaw) + z * cos(house.yaw)];
  };
  return { house, badge, connector, door: transform(WORKSHOP_BUILDING.door), pivot: transform(WORKSHOP_BUILDING.pivot) };
}
export function workshopSignPlacement(site: WorkshopSite): WorkshopSignPlacement {
  return { pivot: { x: site.pivot[0], y: site.pivot[1], z: site.pivot[2] }, yaw: site.house.yaw,
    scale: site.house.scale / WORKSHOP_BUILDING.house.scale };
}

const ease = (value: number): number => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function workshopSwing(seconds: number, passSeconds: number, reduced = false): number {
  const time = seconds - passSeconds;
  if (seconds <= passSeconds - 0.06 || seconds >= passSeconds + (reduced ? 0.34 : 0.89)) return 0;
  if (reduced) return time < 0.09 ? -0.25 * ease((time + 0.06) / 0.15) : -0.25 * (1 - ease((time - 0.09) / 0.25));
  if (time < 0.14) return -0.45 * ease((time + 0.06) / 0.2);
  if (time < 0.44) return -0.45 + 0.55 * ease((time - 0.14) / 0.3);
  return 0.1 * (1 - ease((time - 0.44) / 0.45));
}

interface Point { x: number; y: number; z: number }
interface PassWindow { readonly start: number; readonly end: number; readonly house: Readonly<Point> }
/** Derive the response from the actual connector, rather than a guessed playback timestamp. */
export function findWorkshopPass<T extends Point>(sample: (seconds: number, target: T) => void, point: T,
  window: PassWindow = { start: 9.3, end: 10.1, house: WORKSHOP_BUILDING.house }): number {
  const { start, end, house } = window;
  if (![start, end, house.x, house.y, house.z].every(Number.isFinite) || end < start) throw new Error('Invalid Workshop pass interval');
  const distance = (time: number): number => {
    sample(time, point);
    return (point.x - house.x) ** 2 + (point.y - house.y) ** 2 + (point.z - house.z) ** 2;
  };
  if (start === end) return start;
  const steps = Math.max(1, Math.ceil((end - start) / 0.01));
  const pitch = (end - start) / steps;
  let closest = start, minimum = Infinity;
  for (let step = 0; step <= steps; step++) {
    const time = start + step * pitch, candidate = distance(time);
    if (candidate < minimum) { closest = time; minimum = candidate; }
  }
  let low = Math.max(start, closest - pitch), high = Math.min(end, closest + pitch);
  for (let iteration = 0; iteration < 32; iteration++) {
    const a = low + (high - low) / 3, b = high - (high - low) / 3;
    if (distance(a) <= distance(b)) high = b; else low = a;
  }
  return (low + high) / 2;
}


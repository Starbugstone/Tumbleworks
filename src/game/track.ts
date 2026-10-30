import { TRACK } from './layout';

export interface TrackPoint {
  readonly x: number;
  readonly y: number;
  /** Radians, direction of travel. */
  readonly angle: number;
}

const { cx, cy, straightHalf: s, radius: r } = TRACK;
const ARC = Math.PI * r;
export const TRACK_LENGTH = 4 * s + 2 * ARC;

/** A point on the belt's centre line. u = 0 is top centre, travel is clockwise, and u wraps at 1. */
export function trackPoint(u: number): TrackPoint {
  let d = (((u % 1) + 1) % 1) * TRACK_LENGTH;
  if (d < s) return { x: cx + d, y: cy - r, angle: 0 };
  d -= s;
  if (d < ARC) {
    const a = d / r - Math.PI / 2;
    return { x: cx + s + r * Math.cos(a), y: cy + r * Math.sin(a), angle: a + Math.PI / 2 };
  }
  d -= ARC;
  if (d < 2 * s) return { x: cx + s - d, y: cy + r, angle: Math.PI };
  d -= 2 * s;
  if (d < ARC) {
    const a = d / r + Math.PI / 2;
    return { x: cx - s + r * Math.cos(a), y: cy + r * Math.sin(a), angle: a + Math.PI / 2 };
  }
  d -= ARC;
  return { x: cx - s + d, y: cy - r, angle: 0 };
}

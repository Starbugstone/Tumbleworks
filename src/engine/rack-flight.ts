/** The group rises within its source opening, clears intervening rims and drops inside its destination. */
const LIFT_END = .26;

/** A loaded marble stretches to .58 and the torus stands .07 above its centre. */
export const RIM_CLEARANCE = .76;

export function rackFlightAcross(u: number): number {
  const t = Math.max(0, Math.min(1, (u - LIFT_END) / (1 - 2 * LIFT_END)));
  return t * t * (3 - 2 * t);
}

export function rackFlightY(from: number, to: number, clearance: number, u: number): number {
  const crossing = Math.max(from, to, clearance);
  if (u < LIFT_END) {
    const falloff = 1 - u / LIFT_END;
    return crossing - (crossing - from) * falloff * falloff;
  }
  if (u > 1 - LIFT_END) {
    const drop = (u - 1 + LIFT_END) / LIFT_END;
    return crossing - (crossing - to) * drop * drop;
  }
  const t = (u - LIFT_END) / (1 - 2 * LIFT_END);
  return crossing + .12 * Math.sin(Math.PI * t) ** 2;
}

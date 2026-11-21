/** The marble rises inside its own tube before crossing the rack, then drops through the destination opening. */
const LIFT_END = .26;
const near = (1 - LIFT_END) ** 3;
const far = LIFT_END ** 3;
const crown = 3 * LIFT_END * (1 - LIFT_END);

export function rackFlightHeight(fromY: number, toY: number, clearance: number): number {
  // The cubic is concave above both endpoints. Its lower end over the crossing interval sets the safe control height.
  return Math.max(Math.max(fromY, toY) + .8,
    (clearance - near * fromY - far * toY) / crown,
    (clearance - near * toY - far * fromY) / crown);
}

export function rackFlightAcross(u: number): number {
  const t = Math.max(0, Math.min(1, (u - LIFT_END) / (1 - 2 * LIFT_END)));
  return t * t * (3 - 2 * t);
}

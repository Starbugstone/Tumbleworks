import { RoundedCircuit, type BeltPath } from '../engine/belt-path';
import { BOX, dockDistanceFor, FUNNEL, MARBLE_RADIUS, RACEWAY, RIDE_Y } from '../machine/layout';

interface Point { x: number; y: number; z: number }

export const FUNNEL_SHOE = { halfFloor: .42, lipX: .44, lipWidth: .095 } as const;

export function funnelFeed(track: BeltPath, entry: number): { top: Point; bottom: Point } {
  const land = track.point(entry);
  const { neck, neckY, chuteClearance } = FUNNEL;
  const top = { x: 0, y: neckY - .04, z: neck.z };
  const bottom = { x: land.x, y: RIDE_Y + land.y + MARBLE_RADIUS + chuteClearance, z: land.z };
  if (track instanceof RoundedCircuit) {
    // The tilted lip has a lower edge. Shorten the pipe along its axis to clear the raised belt rim.
    const rise = .09 / Math.hypot(top.x - bottom.x, top.y - bottom.y, top.z - bottom.z);
    bottom.x += (top.x - bottom.x) * rise;
    bottom.y += (top.y - bottom.y) * rise;
    bottom.z += (top.z - bottom.z) * rise;
  }
  return { top, bottom };
}

/** The receiving shoe begins outside the belt wall and ends behind the box, leaving room to choose a pocket. */
export function funnelChute(track: BeltPath, x: number) {
  const outlet = track.point(dockDistanceFor(track, x));
  const nose = { x, y: 0, z: BOX.z - .77 };
  const dx = nose.x - outlet.x, dz = nose.z - outlet.z, span = Math.hypot(dx, dz);
  // A tangent can meet a curved outer wall obliquely, especially at the outermost dock of an eight.
  let edge = 0;
  const outerLip = FUNNEL_SHOE.lipX + FUNNEL_SHOE.lipWidth / 2;
  const sides = track instanceof RoundedCircuit ? [-outerLip, 0, outerLip] : [0];
  for (let i = 1; i <= 48; i++) {
    const t = i / 48;
    const x = outlet.x + dx * t, z = outlet.z + dz * t;
    const crossesRim = sides.some(side => {
      const p = track.nearest(x + dz / span * side, z - dx / span * side);
      return Math.abs(p.lateral) < RACEWAY.channelHalf + RACEWAY.wallThickness + .055;
    });
    if (crossesRim) edge = t;
  }
  const start = Math.min(.93, edge + 1 / 48);
  const floor = RACEWAY.floorY + outlet.y + RACEWAY.wallHeight + .065;
  const head = { x: outlet.x + dx * start, y: floor, z: outlet.z + dz * start };
  nose.y = floor - span * (1 - start) * .12;
  return { head, nose, outlet, yaw: Math.atan2(dx, dz), length: span * (1 - start) };
}

export type FunnelChute = ReturnType<typeof funnelChute>;
const CONTACT = MARBLE_RADIUS * Math.sqrt(1 + .12 ** 2);

/** Pick up over the belt edge, roll on the shoe, then leave its nose for the actual receiving pocket. */
export function funnelTransferPose(chute: FunnelChute, from: Point, to: Point, fraction: number, out: Point): void {
  const { head, nose } = chute;
  if (fraction < .34) {
    const u = fraction / .34;
    out.x = from.x + (head.x - from.x) * u;
    out.z = from.z + (head.z - from.z) * u;
    out.y = from.y + (head.y + CONTACT - from.y) * u + .49 * Math.sin(Math.PI * u);
  } else if (fraction < .62) {
    const u = (fraction - .34) / .28;
    out.x = head.x + (nose.x - head.x) * u;
    out.z = head.z + (nose.z - head.z) * u;
    out.y = head.y + (nose.y - head.y) * u + CONTACT;
  } else {
    const u = Math.min(1, (fraction - .62) / .38);
    const across = u * (2 - u);
    out.x = nose.x + (to.x - nose.x) * across;
    out.z = nose.z + (to.z - nose.z) * across;
    out.y = nose.y + CONTACT + (to.y - nose.y - CONTACT) * u * u + .15 * Math.sin(Math.PI * u);
  }
}

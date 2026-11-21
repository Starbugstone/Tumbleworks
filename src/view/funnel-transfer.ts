import { BOX, MARBLE_RADIUS, RACEWAY, type Track } from '../machine/layout';

interface Point { x: number; y: number; z: number }

/** The receiving shoe begins outside the belt wall and ends behind the box, leaving room to choose a pocket. */
export function funnelChute(track: Pick<Track, 'nearest' | 'point'>, x: number) {
  const outlet = track.point(track.nearest(x, RACEWAY.centerZ + RACEWAY.radius).distance);
  const nose = { x, y: 0, z: BOX.z - .77 };
  const dx = nose.x - outlet.x, dz = nose.z - outlet.z, span = Math.hypot(dx, dz);
  // A tangent can meet a curved outer wall obliquely, especially at the outermost dock of an eight.
  let edge = 0;
  for (let i = 1; i <= 48; i++) {
    const t = i / 48;
    const axis = track.nearest(outlet.x + dx * t, outlet.z + dz * t);
    if (Math.abs(axis.lateral) < RACEWAY.channelHalf + RACEWAY.wallThickness + .055) edge = t;
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

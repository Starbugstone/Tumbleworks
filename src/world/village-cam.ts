interface CamRow { readonly time: number; readonly angle: number; readonly speed: number }
export interface CamDrive {
  readonly contact: number;
  readonly joules: number;
  readonly inertia: number;
  readonly dragTorque: number;
  readonly gateMass: number;
  readonly gateLift: number;
  readonly riseAngle: number;
  readonly gravity: number;
}
/** One contact powers a smooth cam lift and a finite shaft coast.
 * The gate's potential AND kinetic energy are included in the shaft equation.
 * Gate remains latched up after the first cam rise; coast cannot pump it again.
 */
export class VillageCam {
  readonly end: number;
  readonly gateOpen: number;
  readonly turns: number;
  private readonly rows: readonly CamRow[];
  angle = 0;
  speed = 0;
  lift = 0;
  constructor(readonly drive: CamDrive, angleStep = .005) {
    const { contact, joules, inertia, dragTorque, gateMass, gateLift, riseAngle, gravity } = drive;
    if (![contact, joules, inertia, dragTorque, gateMass, gateLift, riseAngle, gravity, angleStep].every(Number.isFinite)
      || joules <= 0 || inertia <= 0 || dragTorque <= 0 || gateMass < 0 || gateLift < 0
      || riseAngle <= 0 || gravity <= 0 || angleStep <= 0) throw new Error('Invalid cam drive');
    const gateWork = gateMass * gravity * gateLift;
    if (joules <= gateWork + dragTorque * riseAngle) throw new Error('Contact energy cannot open gate');
    const lastAngle = (joules - gateWork) / dragTorque;
    this.turns = lastAngle / (2 * Math.PI);
    const angularSpeed = (angle: number): number => {
      if (angle >= lastAngle) return 0;
      const phase = Math.min(1, angle / riseAngle);
      const height = gateLift * (1 - Math.cos(Math.PI * phase)) / 2;
      const slope = angle >= riseAngle ? 0 : gateLift * Math.PI / (2 * riseAngle) * Math.sin(Math.PI * phase);
      const energy = joules - dragTorque * angle - gateMass * gravity * height;
      if (energy < 0) throw new Error('Cam stalls before opening');
      return Math.sqrt(2 * energy / (inertia + gateMass * slope * slope));
    };
    const rows: CamRow[] = [{ time: contact, angle: 0, speed: angularSpeed(0) }];
    let open = contact;
    while (rows[rows.length - 1]!.angle < lastAngle) {
      const previous = rows[rows.length - 1]!;
      const angle = Math.min(lastAngle, previous.angle < riseAngle ? Math.min(riseAngle, previous.angle + angleStep) : previous.angle + angleStep);
      const speed = angularSpeed(angle);
      const time = previous.time + 2 * (angle - previous.angle) / (previous.speed + speed);
      rows.push({ time, angle, speed });
      if (angle === riseAngle) open = time;
    }
    this.rows = rows; this.end = rows[rows.length - 1]!.time; this.gateOpen = open;
  }
  sample(seconds: number): void {
    if (!Number.isFinite(seconds)) throw new Error('Invalid cam time');
    if (seconds <= this.drive.contact) { this.angle = 0; this.speed = 0; this.lift = 0; return; }
    const rows = this.rows, t = Math.min(this.end, seconds);
    let lo = 0, hi = rows.length - 1;
    while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (rows[mid]!.time <= t) lo = mid; else hi = mid; }
    const a = rows[lo]!, b = rows[hi]!, dt = b.time - a.time, u = (t - a.time) / dt;
    const u2 = u * u, u3 = u2 * u;
    this.angle = (2 * u3 - 3 * u2 + 1) * a.angle + (u3 - 2 * u2 + u) * dt * a.speed
      + (-2 * u3 + 3 * u2) * b.angle + (u3 - u2) * dt * b.speed;
    this.speed = seconds >= this.end ? 0 : ((6 * u2 - 6 * u) * a.angle + (3 * u2 - 4 * u + 1) * dt * a.speed
      + (-6 * u2 + 6 * u) * b.angle + (3 * u2 - 2 * u) * dt * b.speed) / dt;
    this.lift = this.drive.gateLift * (1 - Math.cos(Math.PI * Math.min(1, this.angle / this.drive.riseAngle))) / 2;
  }
}

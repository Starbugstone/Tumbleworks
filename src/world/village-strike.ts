interface StrikeRow { readonly time: number; readonly distance: number; readonly speed: number }
/** A marble impact drives the real sliding/turning striker. Effective mass comes
 * from that same rigid-body trajectory; the endpoint absorbs remaining energy.
 */
export class VillageStrike {
  readonly outgoingSpeed: number;
  readonly transferredEnergy: number;
  readonly end: number;
  readonly endpointLoss: number;
  readonly rows: readonly StrikeRow[];
  distance = 0;
  constructor(readonly contact: number, incomingSpeed: number, marbleMass: number, inertiaFactor: number,
    readonly drive: { readonly mass: number; readonly inertia: number; readonly friction: number; readonly stroke: number }) {
    if (![contact, incomingSpeed, marbleMass, inertiaFactor, drive.mass, drive.inertia, drive.friction, drive.stroke].every(Number.isFinite)
      || incomingSpeed <= 0 || marbleMass <= 0 || inertiaFactor < 1 || drive.mass <= 0 || drive.inertia < 0 || drive.friction < 0 || drive.stroke <= 0) throw new Error('Invalid striker impact');
    const massAt = (q: number) => {
      const angle = -1.4 * q;
      const dx = 1 + 1.4 * (Math.sin(angle) * .0766 + Math.cos(angle) * .759);
      const dy = -1.4 * (Math.cos(angle) * .0766 - Math.sin(angle) * .759);
      return drive.mass * (dx * dx + dy * dy + 4) + drive.inertia * 1.4 ** 2;
    };
    const incomingMass = marbleMass * inertiaFactor, targetMass = massAt(0);
    this.outgoingSpeed = (incomingMass - targetMass) / (incomingMass + targetMass) * incomingSpeed;
    if (this.outgoingSpeed <= 0) throw new Error('Striker reverses marble; assembly must be reauthored');
    const initial = 2 * incomingMass / (incomingMass + targetMass) * incomingSpeed;
    this.transferredEnergy = .5 * targetMass * initial ** 2;
    const energyAt = (q: number) => this.transferredEnergy - drive.friction * q
      + drive.mass * 9.81 * (.759 - (Math.sin(-1.4 * q) * .0766 + Math.cos(-1.4 * q) * .759));
    const rows: StrikeRow[] = [{ time: contact, distance: 0, speed: initial }];
    for (let i = 1; i <= 256; i++) {
      const distance = drive.stroke * i / 256, energy = energyAt(distance);
      if (energy <= 0) throw new Error('Striker stalls before its real end stop');
      const speed = Math.sqrt(2 * energy / massAt(distance)), previous = rows[i - 1]!;
      rows.push({ time: previous.time + 2 * (distance - previous.distance) / (previous.speed + speed), distance, speed });
    }
    this.rows = rows; this.end = rows[rows.length - 1]!.time; this.endpointLoss = energyAt(drive.stroke);
  }
  sample(seconds: number): void {
    if (!Number.isFinite(seconds)) throw new Error('Invalid strike time');
    if (seconds <= this.contact) { this.distance = 0; return; }
    if (seconds >= this.end) { this.distance = this.drive.stroke; return; }
    let low = 0, high = this.rows.length - 1;
    while (low + 1 < high) { const mid = (low + high) >>> 1; if (this.rows[mid]!.time <= seconds) low = mid; else high = mid; }
    const a = this.rows[low]!, b = this.rows[high]!, dt = b.time - a.time, u = (seconds - a.time) / dt;
    const u2 = u * u, u3 = u2 * u;
    this.distance = (2 * u3 - 3 * u2 + 1) * a.distance + (u3 - 2 * u2 + u) * dt * a.speed
      + (-2 * u3 + 3 * u2) * b.distance + (u3 - u2) * dt * b.speed;
  }
}

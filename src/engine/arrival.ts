/**
 * How a piece answers a marble that lands on it. Every game shares these, so a landing reads the same way
 * in a box, a lorry and a tube: the marble arrives big and flat and springs back round, and what it lands
 * on gives under the blow, overshoots once and settles.
 */

/** A damped spring about zero. It only moves when struck, and comes back to exactly zero. */
export class Spring {
  value = 0;
  velocity = 0;
  private readonly stiffness: number;
  private readonly damping: number;

  /** `hertz` is how fast it swings; a `ratio` under 1 lets it overshoot, and the lower the longer it rings. */
  constructor(hertz: number, ratio: number) {
    const omega = Math.PI * 2 * hertz;
    this.stiffness = omega * omega;
    this.damping = 2 * ratio * omega;
  }

  /** Blows that land inside one swing add up only as far as `limit`, so a stream of landings hums instead of piling up. */
  kick(velocity: number, limit = Math.abs(velocity) * 1.5): void {
    this.velocity = Math.max(-limit, Math.min(limit, this.velocity + velocity));
  }

  step(seconds: number): number {
    if (this.resting) return 0;
    let left = Math.min(Math.max(0, seconds), 0.1);
    while (left > 1e-6) {
      const dt = Math.min(left, 1 / 120);
      this.velocity += (-this.stiffness * this.value - this.damping * this.velocity) * dt;
      this.value += this.velocity * dt;
      left -= dt;
    }
    if (Math.abs(this.value) < 2e-4 && Math.abs(this.velocity) < 4e-3) this.reset();
    return this.value;
  }

  get resting(): boolean { return this.value === 0 && this.velocity === 0; }
  reset(): void { this.value = this.velocity = 0; }
}

/** How long a landed marble keeps moving, in seconds. */
export const SEAT_SECONDS = 0.34;

/**
 * A marble `age` seconds after it touched down: how far it stands above its seat, and how wide and tall
 * it is drawn. It hits flat and a little large, rebounds once, taps down a second time and is round and
 * still by `SEAT_SECONDS`. `weight` scales the whole answer: below 1 for a quiet landing.
 */
export function seat(age: number, weight: number, into: { lift: number; wide: number; tall: number }): void {
  if (age >= SEAT_SECONDS || weight <= 0) { into.lift = 0; into.wide = into.tall = 1; return; }
  const start = 0.03, first = 0.17, second = 0.11;
  let lift = 0;
  if (age >= start && age < start + first) lift = 0.26 * Math.sin((age - start) / first * Math.PI);
  else if (age >= start + first && age < start + first + second) lift = 0.07 * Math.sin((age - start - first) / second * Math.PI);
  // The pop: larger on the frame it lands, a small undershoot, then its own size.
  const pop = 0.22 * Math.exp(-age * 20) * Math.cos(age * 34);
  // Flat under the blow; a little tall while it is off its seat.
  const flat = 0.24 * Math.exp(-age * 30) - lift * 0.3;
  into.lift = lift * weight;
  into.wide = 1 + (pop + flat * 0.5) * weight;
  into.tall = 1 + (pop - flat) * weight;
}

/**
 * How strongly one landing may answer while fast forward is held or landings come in a stream. Held speed
 * brings three or five times the landings each second; the pieces then only breathe under them.
 */
export function landingWeight(speed: number): number {
  return speed > 1 ? 0.3 : 1;
}

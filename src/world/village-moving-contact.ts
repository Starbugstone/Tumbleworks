/** Moving-surface dynamics. No film/story timings are consumed. */
import { Vector3 } from 'three';
type V = readonly [number, number, number];
export interface SurfaceMotion {
  /** World position of local marble-centre x=0, not the deck underside. */
  origin: V;
  tangent: V;
  normal: V;
  originVelocity: V;
  originAcceleration: V;
  angularVelocity: V;
  angularAcceleration: V;
}
export interface SurfaceDrive {
  readonly sourceId: string;
  /** Mechanical, finite stroke; timing comes from its drive, never station.end. */
  sample(seconds: number): SurfaceMotion;
  /** Requires outlet alignment and zero endpoint motion relative to its dock. */
  acceptsOutlet(seconds: number): boolean;
}
export interface ContactMechanics {
  mass: number;
  radius: number;
  inertiaFactor: number;
  gravity: number;
  friction: number;
}
export interface MovingState { seconds: number; x: number; velocity: number }
export interface MovingRow extends MovingState {
  position: V;
  normal: V;
  kineticPlusPotential: number;
  reaction: number;
}

function evaluate(drive: SurfaceDrive, mechanics: ContactMechanics, state: MovingState) {
  const frame = drive.sample(state.seconds), e = new Vector3(...frame.tangent), n = new Vector3(...frame.normal);
  if (Math.abs(e.lengthSq() - 1) > 1e-8 || Math.abs(n.lengthSq() - 1) > 1e-8 || Math.abs(e.dot(n)) > 1e-8) throw new Error('Invalid moving frame');
  const omega = new Vector3(...frame.angularVelocity), alpha = new Vector3(...frame.angularAcceleration);
  // Pitch and yaw are supported; banking about the rolling axis needs an
  // additional free-spin state. Never silently lock the sphere to that twist.
  if (Math.abs(omega.dot(e)) > 1e-8) throw new Error('Moving bank needs a free-spin contact solver');
  const arm = e.clone().multiplyScalar(state.x), position = new Vector3(...frame.origin).add(arm);
  const baseAcceleration = new Vector3(...frame.originAcceleration)
    .add(new Vector3().crossVectors(alpha, arm))
    .add(new Vector3().crossVectors(omega, new Vector3().crossVectors(omega, arm)));
  const binormal = new Vector3().crossVectors(n, e);
  const gravity = new Vector3(0, -mechanics.gravity, 0);
  const k = mechanics.inertiaFactor - 1;
  const acceleration = (gravity.dot(e) - baseAcceleration.dot(e)
    - k * mechanics.radius * alpha.dot(binormal)) / mechanics.inertiaFactor;
  const worldAcceleration = baseAcceleration.clone().addScaledVector(e, acceleration)
    .add(new Vector3().crossVectors(omega, e).multiplyScalar(2 * state.velocity));
  const contactForcePerMass = worldAcceleration.sub(gravity);
  const reaction = contactForcePerMass.dot(n);
  if (reaction <= 0) throw new Error('Moving surface loses marble support');
  const tangential = contactForcePerMass.clone().addScaledVector(n, -reaction).length();
  if (tangential > mechanics.friction * reaction) throw new Error('Moving surface exceeds available traction');
  const worldVelocity = new Vector3(...frame.originVelocity)
    .add(new Vector3().crossVectors(omega, arm)).addScaledVector(e, state.velocity);
  // A yawing deck does not force spin about its contact normal: no-slip only
  // constrains the two tangential components of angular velocity.
  const spin = omega.clone().addScaledVector(n, -omega.dot(n)).addScaledVector(binormal, state.velocity / mechanics.radius);
  const energy = .5 * mechanics.mass * worldVelocity.lengthSq()
    + .5 * mechanics.mass * k * mechanics.radius ** 2 * spin.lengthSq()
    + mechanics.mass * mechanics.gravity * position.y;
  return { acceleration, energy, position: position.toArray() as [number, number, number], normal: frame.normal, reaction };
}

/** RK4 compile with bracketed exit event. Caller checks each row against actual
 * rendered cup/channel geometry, then pays positive work into its finite ledger.
 * It cannot silently capture: a retaining cup needs a separate solved contact law.
 */
export function compileMovingRoll(drive: SurfaceDrive, mechanics: ContactMechanics,
  initial: MovingState, exitX: number, maximumSeconds: number, step = 1 / 1000) {
  if (!drive.sourceId || !(step > 0) || !(maximumSeconds > initial.seconds)
    || ![mechanics.mass, mechanics.radius, mechanics.gravity].every(value => Number.isFinite(value) && value > 0)
    || !(mechanics.inertiaFactor >= 1) || !(mechanics.friction >= 0)) throw new Error('Invalid moving roll');
  const direction = Math.sign(exitX - initial.x);
  if (!direction) throw new Error('Empty moving roll');
  const advance = (s: MovingState, h: number): MovingState => {
    const a1 = evaluate(drive, mechanics, s).acceleration;
    const s2 = { seconds: s.seconds + h / 2, x: s.x + s.velocity * h / 2, velocity: s.velocity + a1 * h / 2 };
    const a2 = evaluate(drive, mechanics, s2).acceleration;
    const s3 = { seconds: s.seconds + h / 2, x: s.x + s2.velocity * h / 2, velocity: s.velocity + a2 * h / 2 };
    const a3 = evaluate(drive, mechanics, s3).acceleration;
    const s4 = { seconds: s.seconds + h, x: s.x + s3.velocity * h, velocity: s.velocity + a3 * h };
    const a4 = evaluate(drive, mechanics, s4).acceleration;
    return { seconds: s.seconds + h,
      x: s.x + h * (s.velocity + 2 * s2.velocity + 2 * s3.velocity + s4.velocity) / 6,
      velocity: s.velocity + h * (a1 + 2 * a2 + 2 * a3 + a4) / 6 };
  };
  const rows: MovingRow[] = [];
  let state = initial, suppliedWork = 0;
  let previousEnergy = evaluate(drive, mechanics, state).energy;
  const append = () => {
    const value = evaluate(drive, mechanics, state);
    suppliedWork += Math.max(0, value.energy - previousEnergy);
    previousEnergy = value.energy;
    rows.push({ ...state, position: value.position, normal: value.normal,
      kineticPlusPotential: value.energy, reaction: value.reaction });
  };
  append();
  while (direction * (exitX - state.x) > 1e-10) {
    if (state.seconds >= maximumSeconds) throw new Error('Moving roll never reaches outlet');
    const h = Math.min(step, maximumSeconds - state.seconds);
    let next = advance(state, h);
    if (direction * (next.x - initial.x) < -1e-8) throw new Error('Marble escapes through entry');
    if (direction * (next.x - exitX) >= 0) {
      let lo = 0, hi = h;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2, candidate = advance(state, mid);
        if (direction * (candidate.x - exitX) >= 0) hi = mid; else lo = mid;
      }
      next = advance(state, (lo + hi) / 2);
    }
    state = next; append();
  }
  if (!drive.acceptsOutlet(state.seconds)) throw new Error('Moving outlet is not docked at actual release');
  return { rows, exit: state, suppliedMarbleWork: suppliedWork };
}

/** Production sampling must interpolate LOCAL x/v, then apply drive.sample(t).
 * Interpolating world positions independently would detach the ball from a
 * rotating tray. Renderer and marble use that exact same sampled frame.
 */
export function sampleLocal(rows: readonly MovingRow[], seconds: number, target: MovingState): void {
  const t = Math.max(rows[0]!.seconds, Math.min(rows[rows.length - 1]!.seconds, seconds));
  let lo = 0, hi = rows.length - 1;
  while (lo + 1 < hi) { const mid = (lo + hi) >>> 1; if (rows[mid]!.seconds <= t) lo = mid; else hi = mid; }
  const a = rows[lo]!, b = rows[hi]!, dt = b.seconds - a.seconds;
  if (dt === 0) { target.seconds = t; target.x = a.x; target.velocity = a.velocity; return; }
  const u = (t - a.seconds) / dt, u2 = u * u, u3 = u2 * u;
  target.seconds = t;
  target.x = (2 * u3 - 3 * u2 + 1) * a.x + (u3 - 2 * u2 + u) * dt * a.velocity
    + (-2 * u3 + 3 * u2) * b.x + (u3 - u2) * dt * b.velocity;
  target.velocity = ((6 * u2 - 6 * u) * a.x + (3 * u2 - 4 * u + 1) * dt * a.velocity
    + (-6 * u2 + 6 * u) * b.x + (3 * u2 - 2 * u) * dt * b.velocity) / dt;
}

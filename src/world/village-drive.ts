/** Compile-time accounting. No runtime tick mutates this ledger. */
export type EnergySource =
  | { readonly id: string; readonly kind: 'weight'; readonly meshId: string;
      readonly mass: number; readonly top: number; readonly bottom: number }
  | { readonly id: string; readonly kind: 'spring'; readonly meshId: string;
      readonly stiffness: number; readonly compression: number };
export interface EnergyDraw { readonly source: string; readonly consumer: string; readonly joules: number }

export class FiniteDriveLedger {
  private readonly remaining = new Map<string, number>();
  readonly draws: EnergyDraw[] = [];
  constructor(readonly sources: readonly EnergySource[], gravity: number,
    /** Must resolve to an actual rendered source and validate its complete stroke. */
    verifyGeometry: (source: EnergySource) => boolean) {
    if (!(gravity > 0) || !Number.isFinite(gravity)) throw new Error('Invalid gravity');
    for (const source of sources) {
      if (!source.id || !source.meshId || this.remaining.has(source.id) || !verifyGeometry(source)) {
        throw new Error('Missing, duplicated or unrendered energy source');
      }
      if (source.kind === 'weight' && (!(source.mass > 0) || !(source.top > source.bottom))) throw new Error('Invalid weight stroke');
      if (source.kind === 'spring' && (!(source.stiffness > 0) || !(source.compression > 0))) throw new Error('Invalid spring stroke');
      const energy = source.kind === 'weight' ? source.mass * gravity * (source.top - source.bottom)
        : .5 * source.stiffness * source.compression ** 2;
      if (!Number.isFinite(energy)) throw new Error('Invalid stored energy');
      this.remaining.set(source.id, energy);
    }
  }
  draw(source: string, consumer: string, joules: number): void {
    const available = this.remaining.get(source);
    if (available === undefined || !consumer || !Number.isFinite(joules) || joules < 0) throw new Error('Invalid drive transfer');
    if (joules > available) throw new Error(`Drive ${source} exhausted by ${consumer}`);
    this.remaining.set(source, available - joules);
    this.draws.push({ source, consumer, joules });
  }
  available(source: string): number {
    const available = this.remaining.get(source);
    if (available === undefined) throw new Error('Unknown drive');
    return available;
  }
}

/** Draw from incoming rolling energy, never create a fresh station velocity. */
export function contactEnergy(speed: number, mass: number, inertiaFactor: number,
  gateMass: number, gateLift: number, rotorEnergy: number, dissipated: number, gravity: number) {
  if (![speed, mass, inertiaFactor, gateMass, gateLift, rotorEnergy, dissipated, gravity].every(Number.isFinite)
    || speed < 0 || mass <= 0 || inertiaFactor < 1 || gateMass < 0 || gateLift < 0
    || rotorEnergy < 0 || dissipated < 0 || gravity <= 0) throw new Error('Invalid contact transfer');
  const incoming = .5 * mass * inertiaFactor * speed * speed;
  const gateWork = gateMass * gravity * gateLift;
  const outgoing = incoming - gateWork - rotorEnergy - dissipated;
  if (outgoing < 0) throw new Error('Contact cannot power its gate and rotor');
  return { incoming, gateWork, rotorEnergy, dissipated,
    outgoingSpeed: Math.sqrt(2 * outgoing / (mass * inertiaFactor)) };
}

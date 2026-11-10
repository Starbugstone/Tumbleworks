import { Vector3 } from 'three';
import type { VillageProgram } from '../../src/world/village-program';
import type { VillagePort } from '../../src/world/village-plan';

/** The expected author-owned contact orientation; support is checked independently on actual triangles. */
export function normalAt(program: VillageProgram, seconds: number, target: Vector3): void {
  program.normalAt(seconds, target);
}

export function portEdges(port: VillagePort): readonly Vector3[] {
  const center = new Vector3(...port.position), across = new Vector3(...port.tangent).cross(new Vector3(...port.normal)).normalize();
  // The full profile reaches half its authored width, beyond the usable marble corridor.
  return [-0.5, -0.4, 0, 0.4, 0.5].map(fraction => center.clone().addScaledVector(across, port.width * fraction));
}

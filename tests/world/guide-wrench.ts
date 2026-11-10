import { Vector3 } from 'three';
import type { CarriageBrake, GuideReaction, GuideWrench } from '../../src/world/village-carriage-guide';
import type { VillageVec3 } from '../../src/world/village-plan';
/** Verification-only constructive nonnegative allocation on actual guide patches. */
export function allocateGuideWrench(brake: CarriageBrake, force: VillageVec3, moment: VillageVec3): GuideWrench & { readonly reactions: readonly GuideReaction[] } {
    if (![...force, ...moment].every(Number.isFinite)) throw new Error('Guide reactions require finite loads');
    const t = new Vector3(...brake.tangent), n = new Vector3(...brake.normal), b = new Vector3(...brake.across);
    const f = new Vector3(...force), torque = new Vector3(...moment), reactions: GuideReaction[] = [];
    if (Math.abs(f.dot(t)) > 64 * Number.EPSILON * Math.max(1, f.length())) throw new Error('Guide normals cannot supply axial braking');
    const add = (axis: Vector3, signed: number, along: number, lateral: number) => {
      if (signed === 0) return;
      const normal = axis.clone().multiplyScalar(Math.sign(signed));
      const offset = t.clone().multiplyScalar(along);
      if (axis === n) offset.addScaledVector(n, Math.sign(signed) * brake.halfNormal).addScaledVector(b, lateral);
      else offset.addScaledVector(b, Math.sign(signed) * brake.halfAcross);
      reactions.push(Object.freeze({ offset: Object.freeze(offset.toArray()), normal: Object.freeze(normal.toArray()), magnitude: Math.abs(signed) }));
    };
    add(n, f.dot(n), 0, 0); add(b, f.dot(b), 0, 0);
    const a = brake.halfLength, c = brake.halfAcross / 2;
    const aboutN = -torque.dot(n) / (2 * a);
    add(b, aboutN, a, 0); add(b, -aboutN, -a, 0);
    const aboutB = torque.dot(b) / (2 * a);
    add(n, aboutB, a, 0); add(n, -aboutB, -a, 0);
    const aboutT = -torque.dot(t) / (2 * c);
    add(n, aboutT, 0, c); add(n, -aboutT, 0, -c);
    return Object.freeze({ reactions: Object.freeze(reactions), force: Object.freeze([...force] as [number, number, number]),
      moment: Object.freeze([...moment] as [number, number, number]) });
}

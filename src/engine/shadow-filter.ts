import * as THREE from 'three';

/** Three's five rotated, filtered taps per shadowed pixel, each with its own sine and cosine. */
const FIVE_TAPS = /shadow = \(\s*texture\( shadowMap, vec3\( shadowCoord\.xy \+ vogelDiskSample\( 0, 5, phi \)[\s\S]*?\) \* 0\.2;/;

/**
 * One hardware-filtered tap instead of five: a 2×2 comparison blend with a one-texel edge. Shadows were a
 * fifth of the frame, mostly this lookup on every lit surface; the edge gets harder, which the owner accepted.
 */
export function oneTapShadows(chunk: string): string {
  if (!FIVE_TAPS.test(chunk)) throw new Error('Three changed its shadow filter: update src/engine/shadow-filter.ts');
  return chunk.replace(FIVE_TAPS, 'shadow = texture( shadowMap, shadowCoord.xyz );');
}

let applied = false;
/** Patches three's shader source once, before the first shader compiles. */
export function useOneTapShadows(): void {
  if (applied) return;
  THREE.ShaderChunk.shadowmap_pars_fragment = oneTapShadows(THREE.ShaderChunk.shadowmap_pars_fragment);
  applied = true;
}

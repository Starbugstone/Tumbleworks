import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { oneTapShadows } from '../../src/engine/shadow-filter';

describe('one-tap shadows', () => {
  const original = THREE.ShaderChunk.shadowmap_pars_fragment;
  const patched = oneTapShadows(original);
  const pcf = (chunk: string): string => {
    const start = chunk.indexOf('float getShadow( sampler2DShadow');
    return chunk.slice(start, chunk.indexOf('return mix(', start));
  };

  it('samples the shadow map once where three samples it five times', () => {
    expect(pcf(original).match(/texture\( shadowMap/g)).toHaveLength(5);
    expect(pcf(patched).match(/texture\( shadowMap/g)).toHaveLength(1);
  });
  it('leaves the rest of the chunk alone', () => {
    expect(patched.replace(/\s+/g, '').length).toBeLessThan(original.replace(/\s+/g, '').length);
    expect(patched.slice(patched.indexOf('getPointShadow'))).toBe(original.slice(original.indexOf('getPointShadow')));
  });
  it('fails loudly when three changes the filter it replaces', () => {
    expect(() => oneTapShadows('float getShadow() { return 1.0; }')).toThrow(/shadow filter/);
  });
});

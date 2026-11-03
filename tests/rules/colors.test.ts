import { describe, expect, it } from 'vitest';
import { COLOR_CODE, COLORS } from '../../src/sim/types';

describe('the colour registry', () => {
  it('gives every colour its own one-letter code, so search keys never merge two colours', () => {
    const codes = COLORS.map((color) => COLOR_CODE[color]);
    expect(codes.every((code) => code.length === 1)).toBe(true);
    expect(new Set(codes).size).toBe(COLORS.length);
  });
});

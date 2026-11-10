import { describe, expect, it } from 'vitest';
import { worldLayout } from '../../src/world/overview-layout';

describe('the valley window', () => {
  it('shows all six registered places without row navigation', () => {
    const layout = worldLayout(6, { width: 375, height: 690 });
    expect(layout.maxFirstRow).toBe(0);
    expect(layout.villages.map(village => village.chapter)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('keeps the six-place framing for the future campaign and reaches every place', () => {
    const viewport = { width: 375, height: 690 };
    const current = worldLayout(6, viewport);
    const seen = new Set<number>();
    for (let row = 0; row <= 3; row++) {
      const layout = worldLayout(12, viewport, row);
      expect(layout.villages).toHaveLength(6);
      expect(layout.villages.map(village => village.position)).toEqual(current.villages.map(village => village.position));
      expect(layout.labelWidth).toBe(current.labelWidth);
      expect(layout.cameraDistance).toBe(current.cameraDistance);
      layout.villages.forEach(village => seen.add(village.chapter));
    }
    expect([...seen]).toEqual(Array.from({ length: 12 }, (_, index) => index));
    expect(worldLayout(12, viewport, -100).firstRow).toBe(0);
    expect(worldLayout(12, viewport, 100).firstRow).toBe(3);
  });

  it('handles an incomplete last row without inventing another chapter', () => {
    const layout = worldLayout(11, { width: 375, height: 690 }, 3);
    expect(layout.villages.map(village => village.chapter)).toEqual([6, 7, 8, 9, 10]);
    expect(layout.maxFirstRow).toBe(3);
  });

  it('rejects impossible geometry inputs', () => {
    for (const count of [-1, 1.5, NaN]) expect(() => worldLayout(count, { width: 375, height: 690 })).toThrow('Invalid');
    expect(() => worldLayout(6, { width: 0, height: 690 })).toThrow('Invalid');
    expect(() => worldLayout(6, { width: 375, height: 690 }, NaN)).toThrow('Invalid');
  });
});

import { expect, it, vi } from 'vitest';
import { boardBackdrop, setBoardVillage } from '../../src/view/yard-backdrop';

it('paints the same inland pixels as direct terrain sampling and reuses them on the next board', () => {
  // Hashes of the complete RGBA images from the original, unfiltered height sampling.
  const expected = ['3fb4e28b', '889deb28', 'ecef126f', 'ac863dc2', '8d9f5363'];
  const painted: Uint8ClampedArray[] = [];
  const landContext = {
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: (image: ImageData) => painted.push(image.data),
  };
  const surroundContext = {
    fillRect: vi.fn(), drawImage: vi.fn(), createRadialGradient: () => ({ addColorStop: vi.fn() }),
  } as unknown as CanvasRenderingContext2D;
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => landContext }) });
  try {
    for (const [index, hash] of expected.entries()) {
      setBoardVillage(index + 1);
      boardBackdrop().paint!(surroundContext, 512, 72);
      let actual = 2166136261;
      for (const byte of painted[index]!) actual = Math.imul(actual ^ byte, 16777619) >>> 0;
      expect(actual.toString(16).padStart(8, '0')).toBe(hash);
      boardBackdrop().paint!(surroundContext, 512, 72);
      expect(painted).toHaveLength(index + 1);
    }
  } finally {
    setBoardVillage(null);
    vi.unstubAllGlobals();
  }
});

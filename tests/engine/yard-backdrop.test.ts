import { expect, it, vi } from 'vitest';

const directTerrain = await import('../../src/world/village-terrain');
const directPainter = await import('../../src/view/yard-backdrop');
// Load a second painter so both passes have their own paint cache.
vi.resetModules();
const optimizedPainter = await import('../../src/view/yard-backdrop');
const { VILLAGE_SCENE_PLANS } = await import('../../src/world/village-plans');

function capture(painter: typeof optimizedPainter, chapter: number): Uint8ClampedArray {
  const painted: Uint8ClampedArray[] = [];
  const landContext = {
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: (image: ImageData) => painted.push(image.data),
  };
  const drawImage = vi.fn();
  const surroundContext = {
    fillRect: vi.fn(), drawImage, createRadialGradient: () => ({ addColorStop: vi.fn() }),
  } as unknown as CanvasRenderingContext2D;

  vi.stubGlobal('document', { createElement: () => ({ getContext: () => landContext }) });
  try {
    painter.setBoardVillage(chapter);
    painter.boardBackdrop().paint!(surroundContext, 512, 72);
    expect(painted).toHaveLength(1);
    const paintedCanvas = drawImage.mock.lastCall?.[0];
    painter.boardBackdrop().paint!(surroundContext, 512, 72);
    expect(painted).toHaveLength(1);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(drawImage.mock.lastCall?.[0]).toBe(paintedCanvas);
    return painted[0]!;
  } finally {
    painter.setBoardVillage(null);
    vi.unstubAllGlobals();
  }
}

it.each(VILLAGE_SCENE_PLANS.slice(1).map(({ chapter }) => chapter))(
  'chapter %i matches unfiltered terrain sampling for every RGBA byte and reuses the painted land',
  chapter => {
    const resolveRows = vi.spyOn(directTerrain, 'terrainHeightRows').mockImplementation(spec => () => spec);
    let reference: Uint8ClampedArray;
    try {
      reference = capture(directPainter, chapter);
      expect(resolveRows).toHaveBeenCalledTimes(1);
    } finally {
      resolveRows.mockRestore();
    }
    const pixels = capture(optimizedPainter, chapter);
    expect(pixels).toHaveLength(reference.length);
    const firstMismatch = pixels.findIndex((value, byte) => value !== reference[byte]);
    expect(firstMismatch, 'first differing RGBA byte').toBe(-1);
  },
);

import { describe, expect, it } from 'vitest';
import { frameDue } from '../../src/engine/pacing';

/** Frames run per second on a screen refreshing at `hz`, with a little vsync jitter. */
function drawn(hz: number): number {
  let last = 0;
  let count = 0;
  for (let frame = 1; frame <= hz; frame++) {
    const now = frame * 1000 / hz + (frame % 3 - 1) * 0.3;
    if (frameDue(now, last)) { last = now; count++; }
  }
  return count;
}

describe('frame pacing', () => {
  it('draws every frame of a 60 Hz screen', () => expect(drawn(60)).toBe(60));
  it('halves 120 Hz to 60 fps', () => expect(drawn(120)).toBe(60));
  it('keeps 144 Hz at 72 fps', () => expect(drawn(144)).toBe(72));
  it('draws 90 Hz evenly at 45 fps', () => expect(drawn(90)).toBe(45));
  it('runs a frame whose clock went backwards, after the tab came back', () => expect(frameDue(100, 200)).toBe(true));
});

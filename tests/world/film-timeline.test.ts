import { expect, it } from 'vitest';
import { filmTimeline, mechanismMotion, LOCAL_FILM_SECONDS } from '../../src/world/film-timeline';

it('holds the release, follows the whole track, and leaves time for the final mechanism', () => {
  expect(filmTimeline(0)).toMatchObject({ travel: 0, visible: false });
  expect(filmTimeline(0.35)).toMatchObject({ travel: 0, visible: true });
  expect(filmTimeline(9)).toMatchObject({ travel: 1, visible: true });
  expect(mechanismMotion(9, 0).spin).toBeLessThan(0);
  expect(filmTimeline(LOCAL_FILM_SECONDS).visible).toBe(false);
  expect(mechanismMotion(LOCAL_FILM_SECONDS, 0)).toMatchObject({ spin: -4 });
});

it('never triggers a downstream mechanism early and stays finite for every exported frame', () => {
  for (let frame = 0; frame <= LOCAL_FILM_SECONDS * 24; frame++) {
    const seconds = frame / 24;
    const cue = filmTimeline(seconds);
    expect(cue.travel).toBeGreaterThanOrEqual(0); expect(cue.travel).toBeLessThanOrEqual(1);
    for (let index = 0; index < 10; index++) {
      const motion = mechanismMotion(seconds, index);
      expect(Number.isFinite(motion.spin) && Number.isFinite(motion.tilt)).toBe(true);
      if (cue.travel < (9 - index) / 9) expect(motion.spin).toBe(0);
    }
  }
});

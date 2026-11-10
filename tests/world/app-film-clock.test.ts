import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../../src/view/App';
import { WorldView } from '../../src/view/world';

afterEach(() => vi.unstubAllGlobals());

// Omit WebGL/DOM construction, but call both real routing/film-clock methods.
// The cast bridges private presentation state only in this test fixture.
function clock(playing = true, reduced = false) {
  vi.stubGlobal('document', { hidden: false });
  const render = vi.fn(), step = vi.fn(), gameRender = vi.fn();
  const world = Object.assign(Object.create(WorldView.prototype), {
    element: { hidden: false }, ownership: { scene: {} }, view: 'film', playing, dirty: true,
    filmWait: 'ready',
    reduced: { matches: reduced }, filmTime: 0, playback: { duration: 40, render },
    finishFilm: () => { throw new Error('This fixture must remain inside the film'); },
  }) as { filmTime: number; dirty: boolean; advance(seconds: number): boolean };
  const app = Object.assign(Object.create(App.prototype), {
    screen: 'film', world, runtime: { step, render: gameRender, still: true },
  }) as App;
  return { app, world, render, step, gameRender };
}

it.each([0.12, 0.2])('conserves the film clock through %fs App frames without puzzle work', interval => {
  const { app, world, render, step, gameRender } = clock();
  const other = interval === 0.12 ? 0.2 : 0.12;
  const intervals = [interval, other, interval, other];
  let elapsed = 0;
  for (const seconds of intervals) {
    elapsed += seconds;
    expect(app.advance(seconds)).toBe(true);
    expect(world.filmTime).toBeCloseTo(elapsed, 12);
    expect(render).toHaveBeenLastCalledWith(elapsed, true);
  }
  expect(world.filmTime).toBeCloseTo(0.64, 12);
  expect(step).not.toHaveBeenCalled(); expect(gameRender).not.toHaveBeenCalled();
});

it('preserves explicit reduced playback pause and hidden-tab isolation for slow App frames', () => {
  const { app, world, render, step, gameRender } = clock(false, true);
  expect(app.advance(0.12)).toBe(true);
  expect(app.advance(0.2)).toBe(false);
  expect(world.filmTime).toBe(0); expect(render).toHaveBeenCalledExactlyOnceWith(0, false);
  vi.stubGlobal('document', { hidden: true }); world.dirty = true;
  expect(app.advance(0.2)).toBe(false); expect(world.filmTime).toBe(0);
  expect(render).toHaveBeenCalledTimes(1);
  expect(step).not.toHaveBeenCalled(); expect(gameRender).not.toHaveBeenCalled();
});

it.each(['map', 'workshop'])('keeps the existing %s presentation clamp', screen => {
  const world = { advance: vi.fn(() => true) };
  const app = Object.assign(Object.create(App.prototype), { screen, world }) as App;
  expect(app.advance(0.12)).toBe(true); expect(world.advance).toHaveBeenLastCalledWith(0.05);
  expect(app.advance(0.2)).toBe(true); expect(world.advance).toHaveBeenLastCalledWith(0.05);
  expect(app.advance(0.2, false)).toBe(false); expect(world.advance).toHaveBeenCalledTimes(2);
});

it('preserves the eight-tick puzzle catch-up limit and the held-speed cadence', () => {
  const world = { advance: vi.fn() }, step = vi.fn(() => []), render = vi.fn();
  const app = Object.assign(Object.create(App.prototype), {
    screen: 'game', world, runtime: { still: true, step, render }, accumulator: 0,
    speed: 1, redraw: false, feedback: vi.fn(), checkEnding: vi.fn(), refresh: vi.fn(),
  }) as App;
  app.advance(0.12); expect(step).toHaveBeenCalledTimes(7);
  step.mockClear(); app.advance(0.2); expect(step).toHaveBeenCalledTimes(8);
  step.mockClear();
  Object.assign(app, { speed: App.FAST_SPEED, accumulator: 0 });
  app.advance(0.2); expect(step).toHaveBeenCalledTimes(15);
  step.mockClear();
  Object.assign(app, { speed: App.FASTER_SPEED, accumulator: 0 });
  app.advance(0.2); expect(step).toHaveBeenCalledTimes(15);
  expect(world.advance).not.toHaveBeenCalled(); expect(render).not.toHaveBeenCalled();
});

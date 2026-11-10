import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { WorldFilmCamera, type FilmCameraRoute } from '../../src/view/world-film-camera';
import { createRubeSample, RubeRoute, RUBE_DURATION, RUBE_RADIUS, RUBE_REDUCED_CUTS } from '../../src/world/rube-sequence';

import { WorldAssets } from '../../src/view/world-assets';
import { WorldRube } from '../../src/view/world-rube';
import { MeshStandardMaterial } from 'three';

const assets = new WorldAssets();
const actual = new RubeRoute(assets.anchors);
const sample = createRubeSample();
const route: FilmCameraRoute = {
  sample: (seconds, target) => { actual.sample(seconds, sample); target.set(sample.x, sample.y, sample.z); },
  focus: (stop, target) => { actual.focus(stop, target); },
};
const pose = (camera: PerspectiveCamera) => [...camera.position.toArray(), ...camera.quaternion.toArray(), camera.fov, camera.zoom];
const camera = () => new PerspectiveCamera(34, 375 / 690, 0.1, 160);

it('seeks to exactly the same pose regardless of playback direction and returns to the map rest', () => {
  const choreography = new WorldFilmCamera(route), view = camera();
  choreography.apply(view, 0, false); const rest = pose(view);
  for (const time of [0.2, 4, 12.3, 23, RUBE_DURATION]) {
    choreography.apply(view, time, false); const expected = pose(view);
    choreography.apply(view, RUBE_DURATION - time, false);
    choreography.apply(view, time, false); expect(pose(view)).toEqual(expected);
  }
  choreography.apply(view, RUBE_DURATION, false); expect(pose(view)).toEqual(rest);
});

it('uses seven fixed reduced-motion shots with changes only at authored cuts', () => {
  const choreography = new WorldFilmCamera(route), view = camera();
  expect(RUBE_REDUCED_CUTS).toHaveLength(7);
  RUBE_REDUCED_CUTS.forEach((start, index) => {
    const end = RUBE_REDUCED_CUTS[index + 1] ?? RUBE_DURATION;
    choreography.apply(view, start, true); const expected = pose(view);
    for (const fraction of [0.01, 0.4, 0.99]) {
      choreography.apply(view, start + (end - start) * fraction, true);
      expect(pose(view)).toEqual(expected);
    }
  });
});

it('keeps normal camera position continuous through contacts and rest boundaries', () => {
  const choreography = new WorldFilmCamera(route), view = camera();
  const position = new Vector3(), previousVelocity = new Vector3();
  const dt = 1 / 240;
  choreography.apply(view, 0, false); position.copy(view.position);
  for (let frame = 1; frame <= RUBE_DURATION * 240; frame++) {
    choreography.apply(view, frame * dt, false);
    const velocity = view.position.clone().sub(position).divideScalar(dt);
    expect(view.position.toArray().every(Number.isFinite)).toBe(true);
    expect(view.fov).toBe(34); expect(view.zoom).toBe(1);
    // A jump would produce an unbounded finite-difference acceleration as dt shrinks.
    expect(velocity.distanceTo(previousVelocity), `time ${frame * dt}`).toBeLessThan(2);
    previousVelocity.copy(velocity); position.copy(view.position);
  }
  expect(previousVelocity.length()).toBeLessThan(0.01);
});

it('frames the active route point inside the central phone region during the tracking portion', () => {
  const choreography = new WorldFilmCamera(route), view = camera(), point = new Vector3();
  for (let time = 4; time < RUBE_DURATION - 3; time += 0.1) {
    choreography.apply(view, time, false);
    route.sample(time, point); point.project(view);
    const x = (point.x + 1) / 2, y = (1 - point.y) / 2;
    expect(x, `time ${time}`).toBeGreaterThanOrEqual(0.15); expect(x).toBeLessThanOrEqual(0.85);
    expect(y).toBeGreaterThanOrEqual(0.2); expect(y).toBeLessThanOrEqual(0.8);
  }
});

it('uses the same framing contract with the assembled authored rig', () => {
  const material = new MeshStandardMaterial({ vertexColors: true });
  const rig = new WorldRube(assets.anchors, assets, material);
  const choreography = new WorldFilmCamera(rig), view = camera(), point = new Vector3();
  try {
    for (let time = 4; time < RUBE_DURATION - 3; time += 0.1) {
      choreography.apply(view, time, false); rig.sample(time, point); point.project(view);
      expect((point.x + 1) / 2).toBeGreaterThanOrEqual(0.15);
      expect((point.x + 1) / 2).toBeLessThanOrEqual(0.85);
      expect((1 - point.y) / 2).toBeGreaterThanOrEqual(0.2);
      expect((1 - point.y) / 2).toBeLessThanOrEqual(0.8);
    }
  } finally { rig.dispose(); material.dispose(); }
});

it.each([[375, 690], [390, 720], [375, 740], [1280, 800]])(
  'keeps the complete marble sphere inside every fixed shot and connector cut at %d×%d', (width, height) => {
  const choreography = new WorldFilmCamera(route), view = camera(), point = new Vector3();
  view.aspect = width / height; view.updateProjectionMatrix(); choreography.resize(view.aspect);
  const times = new Set(Array.from({ length: RUBE_DURATION * 120 + 1 }, (_, frame) => frame / 120));
  for (const cut of RUBE_REDUCED_CUTS) for (const offset of [-0.00001, 0, 0.00001]) times.add(Math.max(0, Math.min(RUBE_DURATION, cut + offset)));
  for (const time of times) {
    choreography.apply(view, time, true); route.sample(time, point); point.applyMatrix4(view.matrixWorldInverse);
    const depth = -point.z, radius = RUBE_RADIUS;
    expect(depth - radius).toBeGreaterThan(view.near);
    // Tangents to a sphere give its projected silhouette, including off-axis extrema.
    const bounds = (coordinate: number, scale: number): [number, number] => {
      const spread = radius * Math.sqrt(coordinate * coordinate + depth * depth - radius * radius);
      const denominator = depth * depth - radius * radius;
      return [(coordinate * depth - spread) / denominator * scale, (coordinate * depth + spread) / denominator * scale];
    };
    const x = bounds(point.x, view.projectionMatrix.elements[0]!);
    const y = bounds(point.y, view.projectionMatrix.elements[5]!);
    expect(x[0], `sphere left at ${time}`).toBeGreaterThanOrEqual(-1);
    expect(x[1], `sphere right at ${time}`).toBeLessThanOrEqual(1);
    expect(y[0], `sphere bottom at ${time}`).toBeGreaterThanOrEqual(-1);
    expect(y[1], `sphere top at ${time}`).toBeLessThanOrEqual(1);
  }
});

it('rejects invalid aspects and reuses fitted distances until the aspect changes', () => {
  const choreography = new WorldFilmCamera(route);
  const internals = choreography as unknown as { shotDistances: readonly number[] };
  const initial = internals.shotDistances;
  choreography.resize(375 / 690); expect(internals.shotDistances).toBe(initial);
  choreography.resize(375 / 740); expect(internals.shotDistances).not.toBe(initial);
  const resized = internals.shotDistances;
  choreography.resize(375 / 740); expect(internals.shotDistances).toBe(resized);
  for (const invalid of [0, -1, NaN, Infinity]) expect(() => choreography.resize(invalid)).toThrow('finite and positive');
  expect(internals.shotDistances).toBe(resized);
});

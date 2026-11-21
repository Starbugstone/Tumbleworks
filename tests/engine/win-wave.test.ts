import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { Sparks } from '../../src/engine/sparks';
import { WinWave, waveOrder } from '../../src/view/win-wave';

afterEach(() => vi.unstubAllGlobals());

it('visits every finished container once and resolves on the final load in under a second', () => {
  for (const count of [1, 2, 4, 7, 50]) {
    const points = Array.from({ length: count }, (_, index) => ({ index, x: index % 3, y: index % 5 }));
    const last = Math.min(2, count - 1);
    const beats = waveOrder(points, last);
    expect(beats.map(b => b.index).sort((a, b) => a - b)).toEqual(points.map(p => p.index));
    expect(beats.at(-1)!.delay).toBeLessThan(.9);
    expect(beats.at(-1)!.index).toBe(last);
  }
});

function stage() {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal('innerWidth', 375);
  vi.stubGlobal('innerHeight', 690);
  const camera = new PerspectiveCamera(35, 375 / 690, .1, 200);
  camera.position.set(0, 12, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const scene = new Scene();
  return { camera, sparks: new Sparks(scene), scene };
}

it('keeps the four projected fountains inside the HUD clearance and reaches a fifth of the display', () => {
  const { camera, sparks, scene } = stage();
  const starts = [[-.86, -.65], [.86, -.65], [-.65, .66], [.65, .66]];
  const corners = starts.map(([x,y]) => new Vector3(x, y, .985).unproject(camera));
  sparks.finish(corners, 1, camera, 375, 690);
  const peaks = starts.map(() => -Infinity);
  // Measure the projected tips directly from the pooled draw buffers.
  const mesh = scene.children[0] as import('three').Mesh<import('three').InstancedBufferGeometry>;
  let highest = 690;
  for (let frame = 0; frame < 80; frame++) {
    sparks.step(1/60);
    const at = mesh.geometry.getAttribute('aAt');
    for (let i=0; i<mesh.geometry.instanceCount; i++) {
      const p = new Vector3().fromBufferAttribute(at, i).project(camera);
      const y = (1 - p.y) * 345;
      highest = Math.min(highest, y);
      const isRear = p.y > .30;
      const corner = (isRear ? 2 : 0) + (p.x > 0 ? 1 : 0);
      peaks[corner] = Math.max(peaks[corner]!, (1 - starts[corner]![1]!) * 345 - y);
    }
  }
  expect(highest).toBeGreaterThan(56);
  expect(peaks.slice(0,2)).toEqual([expect.closeTo(138, 0), expect.closeTo(138, 0)]);
  expect(peaks.slice(2).every(p => p > 55)).toBe(true);
  expect(sparks.active).toBe(false);
  sparks.dispose();
});

it('settles immediately for reduced motion and cancels future beats on skip', () => {
  const { camera, sparks } = stage();
  const wave = new WinWave();
  const pieces = [0,1,2].map(index => ({ index, at: { x:index, y:0, z:0 }, tint: 0xffaa11 }));
  const land = vi.spyOn(sparks, 'land');
  wave.last = 1;
  wave.start(pieces, [], camera, sparks, 1, true);
  expect(wave.active).toBe(false);
  expect(wave.progress(1)).toBe(1);
  wave.start(pieces, [], camera, sparks, 1, false);
  wave.step(.30, sparks);
  expect(land).toHaveBeenCalledTimes(1);
  wave.clear();
  wave.step(.9, sparks);
  expect(land).toHaveBeenCalledTimes(1);
  expect(wave.pulse(1)).toBe(0);
  sparks.dispose();
});

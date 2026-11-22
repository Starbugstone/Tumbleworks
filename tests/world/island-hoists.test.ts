import { expect, it } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { cinematicWorld } from './cinematic-world-fixture';
import { CinematicHardwareAudit } from './cinematic-hardware';
import { surfaceTriangles } from './surface-overlap';
import { exposedOverlaps } from './village-geometry';
import { islandHoist } from '../../src/view/island-hoists';
import type { VillageCinematic } from '../../src/world/village-cinematic';

/** The two island lifts: Saltmere Pans' brine lift (chapter 6, stop 6) and Potters' Reach's sagger hoist (chapter 7, stop 5). */
const LIFTS = [[6, 6], [7, 5]] as const;

const bounds = (scene: import('three').Object3D, name: string) => {
  const mesh = scene.getObjectByName(name);
  if (!(mesh instanceof Mesh)) throw new Error(`Missing ${name}`);
  return new Box3().setFromObject(mesh);
};
/** Fixed lift hardware in the source plane (guide post, rail, weight guide, pulley beam), excluding the headframe. */
function shaft(scene: import('three').Object3D, stop: number, anchorX: number, weight: Box3): Box3[] {
  const plane = weight.getCenter(new Vector3()).z, found: Box3[] = [];
  scene.getObjectByName(`village-stop-${stop}-static`)!.traverse(object => {
    if (!(object instanceof Mesh) || object.name.startsWith('village-hoist-')) return;
    const box = new Box3().setFromObject(object), centre = box.getCenter(new Vector3());
    if (Math.abs(centre.z - plane) < .1 && centre.x > anchorX - .2 && centre.x < weight.max.x + .2) found.push(box);
  });
  if (found.length < 4) throw new Error(`Stop ${stop} lift shaft hardware not found`);
  return found;
}

it.each(LIFTS)('chapter %i: the headframe sheave stands on the pulley beam between the lift post and the weight guide, and its feet meet the land', (chapter, stop) => {
  const f = cinematicWorld(chapter, true);
  try {
    f.machine.apply(0); f.world.scene.updateMatrixWorld(true);
    const station = f.machine.plan.stations.find(s => s.stop === stop)!;
    const sheave = bounds(f.world.scene, `village-hoist-${stop}-sheave`), weight = bounds(f.world.scene, `village-${stop}-weight-ExtrudeGeometry-0`);
    // The sheave spans from the carrier's guide post to the counterweight guide, above everything in the shaft.
    expect(sheave.min.x).toBeGreaterThan(station.anchor[0]);
    expect(sheave.max.x).toBeLessThan(weight.max.x);
    const shaftTop = Math.max(...shaft(f.world.scene, stop, station.anchor[0], weight).map(box => box.max.y));
    expect(sheave.min.y).toBeGreaterThan(shaftTop);
    const ground = (f.machine as unknown as { groundHeightAt(x: number, z: number): number | undefined }).groundHeightAt;
    let feet = 0;
    f.world.scene.traverse(object => {
      if (!(object instanceof Mesh) || !/^village-hoist-\d-(leg-(left|right)(-pad)?|pier-|plinth-)/.test(object.name)) return;
      const p = object.geometry.getAttribute('position'), lowest = new Box3().setFromObject(object).min.y, v = new Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld);
        if (v.y > lowest + .05) continue;
        const height = ground(v.x, v.z);
        expect(height, `${object.name} foot over land`).toBeDefined();
        expect(Math.abs(v.y - height!), `${object.name} foot on the land`).toBeLessThan(1e-6);
        feet++;
      }
    });
    expect(feet).toBeGreaterThanOrEqual(16);
  } finally { f.dispose(); }
}, 60000);

it.each(LIFTS)('chapter %i: a headframe girt moved into the shaft plane is struck by the travelling lift', (chapter, stop) => {
  const f = cinematicWorld(chapter, true);
  try {
    const route = f.machine.route as VillageCinematic, carry = route.transfers.find(t => t.kind === 'carry' && t.stop === stop)!;
    const times = Array.from({ length: 61 }, (_, i) => carry.start + (carry.end - carry.start) * i / 60);
    const clear = new CinematicHardwareAudit(f.machine, f.world.scene);
    for (const t of times) { f.machine.apply(t); expect(clear.check()).toEqual([]); }
    // The mutant: a horizontal member at mid-height, across the guide post in the shaft's own plane.
    const station = f.machine.plan.stations.find(s => s.stop === stop)!, weight = bounds(f.world.scene, `village-${stop}-weight-ExtrudeGeometry-0`);
    const post = shaft(f.world.scene, stop, station.anchor[0], weight).filter(box => Math.abs(box.getCenter(new Vector3()).x - station.anchor[0]) < .05)
      .sort((a, b) => a.min.y - b.min.y)[0]!, centre = post.getCenter(new Vector3());
    const bar = new BoxGeometry(1.2, .16, .14).translate(centre.x + .3, (post.min.y + post.max.y) / 2, centre.z), mutant = new Mesh(bar);
    mutant.name = `village-hoist-${stop}-mutant`;
    f.world.scene.getObjectByName(`village-stop-${stop}-static`)!.add(mutant);
    f.world.scene.updateMatrixWorld(true);
    const audit = new CinematicHardwareAudit(f.machine, f.world.scene);
    const hits = times.flatMap(t => { f.machine.apply(t); return audit.check(); });
    expect(hits.some(hit => hit.a === mutant.name || hit.b === mutant.name)).toBe(true);
    bar.dispose();
  } finally { f.dispose(); }
}, 120000);

it('keeps the sheave spokes off a shared plane, which the first draft overlapped at the hub', () => {
  const site = { post: [0, 0] as const, guideX: 1.2, beamTop: 5, movingBack: -.2 };
  const root = new Group();
  for (const part of islandHoist('brine', site, () => 0)!) if (/sheave|spoke/.test(part.name)) root.add(new Mesh(part.geometry));
  expect(exposedOverlaps(surfaceTriangles(root))).toEqual([]);
  const old = new Group();
  for (let k = 0; k < 3; k++) old.add(new Mesh(new BoxGeometry(.8, .07, .056).rotateZ(k * Math.PI / 3)));
  expect(exposedOverlaps(surfaceTriangles(old)).length).toBeGreaterThan(0);
});

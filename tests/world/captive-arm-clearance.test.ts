import { expect, it } from 'vitest';
import { BoxGeometry, Mesh, Ray, Triangle, Vector3 } from 'three';
import { sourceMountLayout } from '../../src/view/counterweight';
import { compileTerrain, terrainHeightAt } from '../../src/world/village-terrain';
import { GLASSHOUSE_GARDENS } from '../../src/world/villages/glasshouse-gardens';
import { VillageRollingPrefix } from '../../src/world/village-prefix';
import { villageWorld } from './village-world-fixture';
import { surfaceTriangles } from './surface-overlap';
import { triangleCrossing } from './village-geometry';
import { recordSourceMount as record55 } from './source-mount-record';

function mesh(value: unknown): Mesh {
  if (!(value instanceof Mesh)) throw new Error('Actual native part missing');
  return value;
}

/** The ORIGINAL (pre-71) stop5 hung guide, from the same producer's default path.
 * Its packed extent must still equal the frozen Gardens64 guide preimage. */
function originalStop5Guide(): Mesh {
  const { sourceMount, ...original } = GLASSHOUSE_GARDENS.plan.stations.find(s => s.stop === 5)!;
  expect(sourceMount).toEqual({ x: 2.01, guide: 'grounded' });
  const terrain = compileTerrain(GLASSHOUSE_GARDENS.terrain);
  const layout = sourceMountLayout(original, original.retention!.weightDrop, (x, z) => terrainHeightAt(terrain, x, z));
  if (layout.guide.kind !== 'hung') throw new Error('Original layout must keep its hung guide');
  const guide = new Mesh(new BoxGeometry(...layout.guide.size).translate(...layout.guide.centre));
  guide.name = 'original-stop-5-hung-guide'; guide.updateMatrixWorld(true);
  const p = guide.geometry.getAttribute('position'), xs = [], ys = [], zs = [];
  for (let i = 0; i < p.count; i++) { xs.push(p.getX(i)); ys.push(p.getY(i)); zs.push(p.getZ(i)); }
  expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), Math.min(...zs), Math.max(...zs)])
    .toEqual([3.8564999103546143, 3.8914999961853027, 4.150000095367432, 5.949999809265137, -7.977499961853027, -7.942500114440918]);
  guide.geometry.userData.originalFrozenGuide=true;
  return guide;
}

it('keeps the actual stop5 leaf arm clear of its relocated weight guide, and still crossing the original hung guide', () => {
  const failures = [], original: { normal: boolean; crossings: number }[] = [];
  for (const normal of [true, false]) {
    const f = villageWorld(1, true);
    try {
      f.probe.machine.route.requirePhysical();
      const time = 18.091666666666665;
      f.world.film(time, normal);
      const head = f.world.scene.getObjectByName('village-5-capture-head');
      if (!head) throw new Error('Actual leaf mover missing');
      const arm = surfaceTriangles(head).find(t => t.mesh.userData.retainerPart?.id === 'lift-arm')!.mesh;
      const guide = mesh(f.world.scene.getObjectByName('village-stop-5-static-BoxGeometry-0'));
      expect(arm.userData.retainerPart?.id).toBe('lift-arm');
      for (const a of surfaceTriangles(arm)) for (const b of surfaceTriangles(guide)) {
        if (triangleCrossing(a, b) || triangleCrossing(b, a)) failures.push({
          normal, time, a: arm.name, b: guide.name, faces: [a.index, b.index],
          armMatrix: arm.matrixWorld.toArray(), guideMatrix: guide.matrixWorld.toArray(),
          points: [[a.a, a.b, a.c], [b.a, b.b, b.c]].map(ps => ps.map(p => p.toArray())),
        });
      }
      // Original-layout negative: the reported Gardens64 collision must stay real.
      const hung = originalStop5Guide();
      let crossings = 0;
      for (const a of surfaceTriangles(arm)) for (const b of surfaceTriangles(hung)) if (triangleCrossing(a, b) || triangleCrossing(b, a)) crossings++;
      original.push({ normal, crossings }); hung.geometry.dispose();
    } finally { f.dispose(); }
  }
  record55('strict-arm-fixed-guide', { failures, original });
  expect(failures, 'foreign fixed weight guide is never an intended leaf weld').toEqual([]);
  expect(original.every(row => row.crossings > 0), 'original hung guide still crosses the released arm').toBe(true);
});

// Historical Gardens64 family proof: it is about the ORIGINAL hung guide, so it reads
// that guide from the producer's default path, not the relocated column.
it('proves the selected same8 crest-shortening family has no feasible member, using the original closed guide and open fork', () => {
  const f = villageWorld(1, true);
  try {
    const route = f.probe.machine.route;
    route.requirePhysical();
    const prefix = (route as unknown as { prefix: unknown }).prefix;
    if (!(prefix instanceof VillageRollingPrefix)) throw new Error('Actual retained producer missing');
    const motion = prefix.retained.find(m => m.station.stop === 5)!;
    expect(motion.station.retention?.opening).toBe('captive-leaf');
    const h = Math.SQRT1_2;
    f.world.film(motion.openingEnd, true);
    surfaceTriangles(f.world.scene);
    const leaf = f.world.scene.getObjectByName('village-5-capture-head')!;
    const full = leaf.matrixWorld.clone();
    const guide = originalStop5Guide();
    const packed = guide.geometry.getAttribute('position');
    const points = Array.from({ length: packed.count }, (_, i) =>
      new Vector3().fromBufferAttribute(packed, i).applyMatrix4(guide.matrixWorld));
    const low = new Vector3(...[0, 1, 2].map(k => Math.min(...points.map(p => p.getComponent(k)))) as [number, number, number]);
    const high = new Vector3(...[0, 1, 2].map(k => Math.max(...points.map(p => p.getComponent(k)))) as [number, number, number]);
    const at = (u: number) => new Vector3(h * u, h * u, -.95).applyMatrix4(full);
    const origin = at(0), direction = at(1).sub(origin);
    expect(direction.x).toBeGreaterThan(0);
    const guideU = [(low.x - origin.x) / direction.x, (high.x - origin.x) / direction.x];
    for (const u of guideU) {
      expect(at(u!).y).toBeGreaterThan(low.y);
      expect(at(u!).y).toBeLessThan(high.y);
    }
    expect(origin.z).toBeGreaterThan(low.z);
    expect(origin.z).toBeLessThan(high.z);
    // Rear arm band: -.01<u<t-.02, -.96<z<-.94, -.01<w<.01.
    // If t exceeds this upper bound it contains an actual fixed-guide interior point.
    const necessaryUpper = guideU[0]! + .02;
    guide.geometry.dispose();

    f.world.film(motion.start, true);
    surfaceTriangles(f.world.scene);
    const inverse = leaf.matrixWorld.clone().invert();
    const frame = f.world.scene.getObjectByName('village-5-head-frame')!;
    const cGuide = surfaceTriangles(frame).find(t => t.mesh.userData.retainerPart?.id === 'leaf-guide')!.mesh;
    // Literal closed-edge census, without angular/epsilon welding.
    const local = cGuide.geometry.getAttribute('position'), index = cGuide.geometry.index;
    const edges = new Map<string, { from: string; to: string }[]>();
    const key = (p: Vector3) => p.toArray().join(',');
    for (let i = 0; i < (index?.count ?? local.count); i += 3) {
      const ps = [0, 1, 2].map(k => new Vector3().fromBufferAttribute(local, index ? index.getX(i + k) : i + k));
      for (let k = 0; k < 3; k++) {
        const from = key(ps[k]!), to = key(ps[(k + 1) % 3]!);
        const id = [from, to].sort().join('|'), rows = edges.get(id) ?? [];
        rows.push({ from, to }); edges.set(id, rows);
      }
    }
    for (const rows of edges.values()) {
      expect(rows).toHaveLength(2);
      expect(rows[0]!.from).toBe(rows[1]!.to);
      expect(rows[0]!.to).toBe(rows[1]!.from);
    }
    const line = new Ray(new Vector3(-h, -h, -.925), new Vector3(h, h, 0));
    const entries: number[] = [], exits: number[] = [];
    for (const face of surfaceTriangles(cGuide)) {
      const triangle = new Triangle(...[face.a, face.b, face.c].map(p => p.clone().applyMatrix4(inverse)) as [Vector3, Vector3, Vector3]);
      const hit = line.intersectTriangle(triangle.a, triangle.b, triangle.c, false, new Vector3());
      if (!hit) continue;
      const sign = triangle.getNormal(new Vector3()).dot(line.direction);
      if (sign < 0) entries.push(hit.distanceTo(line.origin) - 1);
      else if (sign > 0) exits.push(hit.distanceTo(line.origin) - 1);
    }
    expect(entries.length).toBeGreaterThan(0); expect(exits.length).toBeGreaterThan(0);
    const lastEntry = Math.max(...entries), firstExit = Math.min(...exits);
    expect(lastEntry).toBeLessThan(.01); expect(firstExit).toBeGreaterThan(.01);
    // A shortened crest beyond the fixed leading attachment requires t>.02. Its medial
    // line u=t-.01 therefore lies in the actual solid until this first exit.
    const necessaryLower = firstExit + .01;

    const tube = mesh(f.world.scene.getObjectByName('village-5-fork-TubeGeometry-0'));
    const W = -.005, intervals: { low: number; high: number; triangle: number; points: number[][] }[] = [];
    const u = (p: Vector3) => (p.x + p.y) * h, w = (p: Vector3) => (p.x - p.y) * h;
    for (const face of surfaceTriangles(tube)) {
      const ps = [face.a, face.b, face.c].map(p => p.clone().applyMatrix4(inverse)), cuts: Vector3[] = [];
      for (let i = 0; i < 3; i++) {
        const a = ps[i]!, b = ps[(i + 1) % 3]!, da = w(a) - W, db = w(b) - W;
        if (da === 0) cuts.push(a);
        if (da * db < 0) cuts.push(a.clone().lerp(b, da / (da - db)));
      }
      if (cuts.length !== 2) continue;
      const [a, b] = cuts as [Vector3, Vector3], dz = b.z - a.z;
      let low = 0, high = 1;
      if (dz === 0) { if (a.z < -.9 || a.z > -.3) continue; }
      else {
        const x = (-.9 - a.z) / dz, y = (-.3 - a.z) / dz;
        low = Math.max(low, Math.min(x, y)); high = Math.min(high, Math.max(x, y));
        if (high <= low) continue;
      }
      const c = a.clone().lerp(b, low), d = a.clone().lerp(b, high);
      if (u(c) === u(d)) continue;
      intervals.push({ low: Math.min(u(c), u(d)), high: Math.max(u(c), u(d)), triangle: face.index, points: [c.toArray(), d.toArray()] });
    }
    intervals.sort((a, b) => a.low - b.low);
    const union: { low: number; high: number; triangles: number[] }[] = [];
    for (const row of intervals) {
      const previous = union.at(-1);
      if (previous && row.low <= previous.high) {
        previous.high = Math.max(previous.high, row.high); previous.triangles.push(row.triangle);
      } else union.push({ low: row.low, high: row.high, triangles: [row.triangle] });
    }
    // Conservative arithmetic envelope for this diagnostic bound only. The raw
    // collision/contact gates retain their original independent tolerances.
    const roundoff = 256 * Number.EPSILON * Math.max(1, ...full.toArray().map(Math.abs), ...inverse.toArray().map(Math.abs));
    const possibleMedial = [necessaryLower - .01 - roundoff, necessaryUpper - .01 + roundoff];
    const covering = union.find(row => row.low + roundoff < possibleMedial[0]! && row.high - roundoff > possibleMedial[1]!);
    record55('same8-crest-independent-bounds', {
      feasible: false, necessaryLower, necessaryUpper, possibleMedial, roundoff,
      fixedGuide: { low: low.toArray(), high: high.toArray(), guideU, matrix: guide.matrixWorld.toArray() },
      closedLeafGuide: { entries, exits, lastEntry, firstExit, edgeCount: edges.size },
      fullLeafMatrix: full.toArray(), openLeafMatrix: leaf.matrixWorld.toArray(),
      slice: { w: W, z: [-.9, -.3], intervals, union }, covering,
    });
    expect(necessaryLower).toBeLessThan(necessaryUpper);
    expect(covering, 'actual open fork covers every otherwise-admissible crest medial coordinate').toBeDefined();
  } finally { f.dispose(); }
});

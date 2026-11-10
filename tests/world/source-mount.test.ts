import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Box3, BoxGeometry, Mesh, Object3D, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { counterweightGeometry, sourceMountLayout, WEIGHT_GUIDE_WIDTH } from '../../src/view/counterweight';
import { compileTerrain, terrainHeightAt } from '../../src/world/village-terrain';
import { villageScenePlan } from '../../src/world/village-plans';
import { GLASSHOUSE_GARDENS } from '../../src/world/villages/glasshouse-gardens';
import { VillageRollingPrefix } from '../../src/world/village-prefix';
import type { VillageRetained } from '../../src/world/village-retained';
import type { VillageStation } from '../../src/world/village-plan';
import { villageWorld } from './village-world-fixture';
import { surfaceTriangles } from './surface-overlap';
import { triangleCrossing, visible } from './village-geometry';

const MOUNT_X = 2.01, MARGIN = .1, HALF = WEIGHT_GUIDE_WIDTH / 2;
// Hand values from gardens-source71/DECISION.md; checked here, never accepted from here.
const HAND_ARM_SUP_X = 4.11815047;
// Measured packed faces of the east village-rim-post-5 brace arm (gardens/source-mount75
// rest-source.json); gardens-source77 derives the interval from them. Cross-checked below.
const POST_WEST_X = 4.266688346862793, POST_EAST_X = 4.386688232421875;

function record(name: string, data: unknown) {
  const label = process.env['S77_LABEL']; if (!label) return;
  if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error('Fresh explicit S77_LABEL required');
  const folder = `output/current/village-layouts/parallel44/gardens/source-mount78/runs/${label}`;
  mkdirSync(folder, { recursive: true }); writeFileSync(`${folder}/${name}.json`, JSON.stringify(data, null, 2), { flag: 'wx' });
}
const named = (root: Object3D, name: string): Mesh => {
  const value = root.getObjectByName(name); if (!(value instanceof Mesh)) throw new Error(`Actual native part ${name} missing`); return value;
};
function packedWorld(mesh: Mesh): Vector3[] {
  mesh.updateWorldMatrix(true, false);
  const p = mesh.geometry.getAttribute('position');
  return Array.from({ length: p.count }, (_, i) => new Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld));
}
const lowest = (points: Vector3[], k: 0 | 1 | 2) => Math.min(...points.map(p => p.getComponent(k)));
const highest = (points: Vector3[], k: 0 | 1 | 2) => Math.max(...points.map(p => p.getComponent(k)));
const gardensStop5 = (): VillageStation => GLASSHOUSE_GARDENS.plan.stations.find(s => s.stop === 5)!;
const ground = () => { const terrain = compileTerrain(GLASSHOUSE_GARDENS.terrain); return (x: number, z: number) => terrainHeightAt(terrain, x, z); };

/** Weight axis inside the guide: the bore leaves real clearance on all four sides. */
function coaxial(weight: Mesh, guide: Mesh): number {
  const centre = weight.getWorldPosition(new Vector3()), g = packedWorld(guide);
  const bore = WEIGHT_GUIDE_WIDTH / 2 + .005;
  return Math.min(lowest(g, 0) - (centre.x - bore), centre.x + bore - highest(g, 0), lowest(g, 2) - (centre.z - bore), centre.z + bore - highest(g, 2));
}
/** Area of the foot rectangle covered by level terrain triangles at exactly the foot height. */
function footCoverage(landscape: Object3D, x: number, z: number, height: number, halfX=HALF,halfZ=HALF): { covered: number; area: number; foreign: number } {
  const rect: [number, number][] = [[x - halfX, z - halfZ], [x + halfX, z - halfZ], [x + halfX, z + halfZ], [x - halfX, z + halfZ]];
  const clip = (poly: [number, number][], a: [number, number], b: [number, number]) => {
    const side = (p: [number, number]) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), out: [number, number][] = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!, q = poly[(i + 1) % poly.length]!, sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if (sp * sq < 0) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return out;
  };
  const area = (poly: [number, number][]) => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]!; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  let covered = 0, foreign = 0;
  for (const face of surfaceTriangles(landscape)) {
    if (face.normal.y <= 0) continue;
    const tri: [number, number][] = [[face.a.x, face.a.z], [face.b.x, face.b.z], [face.c.x, face.c.z]];
    const ccw = (tri[1]![0] - tri[0]![0]) * (tri[2]![1] - tri[0]![1]) - (tri[1]![1] - tri[0]![1]) * (tri[2]![0] - tri[0]![0]) > 0;
    const ordered = ccw ? tri : [tri[0]!, tri[2]!, tri[1]!];
    let poly = rect; for (let i = 0; i < 3 && poly.length; i++) poly = clip(poly, ordered[i]!, ordered[(i + 1) % 3]!);
    const piece = poly.length >= 3 ? area(poly) : 0; if (!(piece > 0)) continue;
    if ([face.a, face.b, face.c].every(p => Object.is(p.y, height))) covered += piece; else foreign += piece;
  }
  return { covered, area:4*halfX*halfZ, foreign };
}

it('enrols only Gardens stop5, and its default path is the original arithmetic', () => {
  const enrolled = [0, 1, 2, 3, 4, 5].flatMap(chapter => villageScenePlan(chapter).plan.stations
    .filter(s => s.sourceMount !== undefined).map(s => ({ chapter, stop: s.stop, mount: s.sourceMount })));
  expect(enrolled).toEqual([{ chapter: 1, stop: 5, mount: { x: MOUNT_X, guide: 'grounded' } }]);
  // The unenrolled layout of stop5 must reproduce the frozen Gardens64 source exactly.
  const { sourceMount, ...original } = gardensStop5();
  expect(sourceMount).toBeDefined();
  const old = sourceMountLayout(original, .8, ground());
  expect(old).toEqual({ weight: [2.674 + 1.2, 3.7 + 2, -7 - .96],
    guide: { kind: 'hung', centre: [2.674 + 1.2, 3.7 + 2 - 1.3 / 2, -7 - .96], size: [.035, 1.3 + .5, .035] },
    beam: { centre: [2.674 + .6, 3.7 + 2.3, -7 - .96], size: [1.5, .1, .3] } });
  // Byte comparison of every unmounted station, all six villages, against a
  // pre-71 baseline recorded by the same digest (S71_BASELINE, JSON).
  const baseline = process.env['S71_BASELINE'];
  const digests: Record<string, string> = {};
  for (const chapter of [0, 1, 2, 3, 4, 5]) {
    const f = villageWorld(chapter, true);
    try {
      f.world.film(0);
      for (const station of f.probe.machine.route.plan.stations) {
        const hash = createHash('sha256');
        f.world.scene.traverse(o => {
          if (!(o instanceof Mesh) || !(o.name.startsWith(`village-stop-${station.stop}-`) || o.name.startsWith(`village-${station.stop}-`))) return;
          if (chapter === 1 && station.stop === 5 && ['village-stop-5-static-BoxGeometry-0', 'village-stop-5-static-BoxGeometry-1'].includes(o.name)) return;
          const a = o.geometry.getAttribute('position').array;
          hash.update(o.name).update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
          hash.update(JSON.stringify(chapter === 1 && station.stop === 5 && o.name.startsWith('village-5-weight') ? 'moved' : o.matrixWorld.toArray()));
        });
        digests[`${chapter}:${station.stop}`] = hash.digest('hex');
      }
    } finally { f.dispose(); }
  }
  record('default-digests', digests);
  if (baseline) expect(digests).toEqual(JSON.parse(readFileSync(baseline, 'utf8')));
});

it('builds one connected relocated source: weight on its column, column on flat land, beam over both', () => {
  const f = villageWorld(1, true);
  try {
    const route = f.probe.machine.route; route.requirePhysical();
    const station = gardensStop5(), xs = station.anchor[0] + MOUNT_X;
    const rows = [];
    for (const time of [0, route.duration]) {
      f.world.film(time); f.world.scene.updateMatrixWorld(true);
      const weightGroup = f.world.scene.getObjectByName('village-5-weight')!;
      const weight = named(f.world.scene, 'village-5-weight-ExtrudeGeometry-0');
      const guide = named(f.world.scene, 'village-stop-5-static-BoxGeometry-0'), beam = named(f.world.scene, 'village-stop-5-static-BoxGeometry-1');
      const w = weightGroup.getWorldPosition(new Vector3()), g = packedWorld(guide), b = packedWorld(beam);
      expect([w.x, w.z]).toEqual([xs, station.anchor[2] - .96]);
      expect(w.y).toBeCloseTo(time ? 4.9 : 5.7, 12);
      expect(guide.geometry.getAttribute('position').count).toBe(new BoxGeometry().getAttribute('position').count);
      const top = highest(g, 1), bottom = lowest(g, 1), beamBottom = lowest(b, 1);
      expect(Object.is(top, beamBottom), 'column top shares the beam underside plane').toBe(true);
      expect(Object.is(bottom, Math.fround(terrainHeightAt(compileTerrain(GLASSHOUSE_GARDENS.terrain), xs, w.z)!))).toBe(true);
      expect(lowest(b, 0)).toBeLessThan(lowest(g, 0)); expect(highest(b, 0)).toBeGreaterThan(highest(g, 0));
      expect(lowest(b, 2)).toBeLessThan(lowest(g, 2)); expect(highest(b, 2)).toBeGreaterThan(highest(g, 2));
      const clearance = coaxial(weight, guide);
      expect(clearance).toBeGreaterThan(.0049);
      const foot = footCoverage(f.world.scene.getObjectByName('village-landscape-1')!, (lowest(g, 0) + highest(g, 0)) / 2, (lowest(g, 2) + highest(g, 2)) / 2, bottom,(highest(g,0)-lowest(g,0))/2,(highest(g,2)-lowest(g,2))/2);
      expect(foot.foreign).toBe(0); expect(Math.abs(foot.covered - foot.area)).toBeLessThan(1e-12);
      rows.push({ time, weight: w.toArray(), guide: [lowest(g, 0), highest(g, 0), bottom, top, lowest(g, 2), highest(g, 2)], beam: [lowest(b, 0), highest(b, 0), beamBottom, highest(b, 1)], clearance, foot });
    }
    // The bored weight keeps the material it had; only its group translation moved.
    const reference = counterweightGeometry();
    try { expect(Array.from(named(f.world.scene, 'village-5-weight-ExtrudeGeometry-0').geometry.getAttribute('position').array))
      .toEqual(Array.from(reference.getAttribute('position').array)); } finally { reference.dispose(); }
    record('connected-source', rows);
  } finally { f.dispose(); }
});

it('separates the complete stop5 moving sweep from the whole relocated source by the selected margin', () => {
  const f = villageWorld(1, true);
  try {
    const route = f.probe.machine.route; route.requirePhysical();
    const prefix = (route as unknown as { prefix: unknown }).prefix;
    if (!(prefix instanceof VillageRollingPrefix)) throw new Error('Actual retained producer missing');
    const motion: VillageRetained = prefix.retained.find(m => m.station.stop === 5)!;
    const times = new Set([motion.start, motion.closureStart, motion.closureEnd, motion.carryStart, motion.carryEnd, motion.openingEnd, motion.end, route.duration]);
    for (let i = Math.floor(motion.start * 120); i <= Math.ceil(route.duration * 120); i++) times.add(Math.min(route.duration, i / 120));
    const movers = ['village-5-carrier', 'village-5-fork', 'village-5-head-frame', 'village-5-capture-head'];
    let sup = -Infinity, at = 0, part = '', weightMin = Infinity, columnMin = Infinity, beamMaxY = -Infinity;
    const zBand = -7.77 + MARGIN; // every moving vertex that could share the weight's z range
    for (const time of [...times].sort((a, b) => a - b)) for (const normal of [true, false]) {
      f.world.film(time, normal); f.world.scene.updateMatrixWorld(true);
      for (const name of movers) f.world.scene.getObjectByName(name)!.traverse(o => {
        if (!(o instanceof Mesh)) return;
        for (const p of packedWorld(o)) if (p.z <= zBand) { beamMaxY = Math.max(beamMaxY, p.y); if (p.x > sup) { sup = p.x; at = time; part = o.name; } }
      });
      weightMin = Math.min(weightMin, lowest(packedWorld(named(f.world.scene, 'village-5-weight-ExtrudeGeometry-0')), 0));
      columnMin = Math.min(columnMin, lowest(packedWorld(named(f.world.scene, 'village-stop-5-static-BoxGeometry-0')), 0));
    }
    record('separating-plane', { sup, at, part, weightMin, columnMin, margin: weightMin - sup, hand: HAND_ARM_SUP_X, beamMaxY });
    expect(part).toMatch(/^village-5-capture-head-ExtrudeGeometry/); // the lift arm binds
    expect(at).toBeGreaterThanOrEqual(motion.openingEnd); // the monotone leaf reaches its sup in the held released pose
    expect(Math.abs(sup - HAND_ARM_SUP_X)).toBeLessThan(1e-6); // hand cross-check only
    expect(weightMin - sup, 'weight west face clears the whole arm sweep').toBeGreaterThan(MARGIN);
    expect(columnMin - sup).toBeGreaterThan(MARGIN);
    expect(beamMaxY).toBeLessThan(5.95 - MARGIN); // nothing moving in the source z band reaches the beam's underside
  } finally { f.dispose(); }
});

it('rejects the original, foreign, disconnected and shifted-source mutants', () => {
  const station = gardensStop5(), at = ground(), sup = HAND_ARM_SUP_X; // cross-checked independently against the measured current sup above
  const { sourceMount, ...original } = station; expect(sourceMount).toBeDefined();
  const weightWest = (s: VillageStation) => sourceMountLayout(s, .8, at).weight[0] - .19;
  const guideWest = (s: VillageStation) => { const g = sourceMountLayout(s, .8, at).guide; return (g.kind === 'hung' ? g.centre[0] : g.x) - HALF; };
  // Original layout: the hung guide sits inside the arm sweep (the Gardens64 collision).
  expect(guideWest(original)).toBeLessThan(sup);
  // Below the swept-envelope bound 1.63415: the weight overlaps the arm sweep in x.
  expect(weightWest({ ...station, sourceMount: { x: 1.63, guide: 'grounded' } })).toBeLessThan(sup);
  // Root's 1.7 hand start: clear, but below the selected .1 margin.
  const start = weightWest({ ...station, sourceMount: { x: 1.7, guide: 'grounded' } }) - sup;
  expect(start).toBeGreaterThan(0); expect(start).toBeLessThan(MARGIN);
  expect(weightWest(station) - sup).toBeGreaterThan(MARGIN);
  // Rim post 5 binds (gardens-source77). No member fits between the arm sweep and the post.
  expect(POST_WEST_X - sup).toBeLessThan(2 * .19);
  const postGap = (x: number) => weightWest({ ...station, sourceMount: { x, guide: 'grounded' } }) - POST_EAST_X;
  expect(postGap(1.75)).toBeLessThan(0); // rejected SM71: straddles the brace arm (18 measured crossings)
  expect(postGap(1.90)).toBeLessThan(0); // just below the strict bound 1.90269
  expect(postGap(2.00)).toBeGreaterThan(0); expect(postGap(2.00)).toBeLessThan(MARGIN); // clear, under margin
  expect(postGap(MOUNT_X)).toBeGreaterThan(MARGIN);
  // Disconnected: no foot (void), a sloped skirt foot, and an unretained or non-finite mount.
  expect(() => sourceMountLayout(station, .8, () => undefined)).toThrow('flat land patch');
  expect(() => sourceMountLayout({ ...station, sourceMount: { x: 1.3, guide: 'grounded' } }, .8, at)).toThrow('flat land patch');
  expect(() => sourceMountLayout({ ...station, sourceMount: { x: Number.NaN, guide: 'grounded' } }, .8, at)).toThrow('finite eastward');
  const { retention: _r, ...unretained } = station;
  expect(() => sourceMountLayout(unretained, .8, at)).toThrow('retained weight');
  // Scene-level mutants on the actual built source (foreign/disconnected/shifted).
  const f = villageWorld(1, true);
  try {
    f.world.film(0); f.world.scene.updateMatrixWorld(true);
    const weight = named(f.world.scene, 'village-5-weight-ExtrudeGeometry-0'), guide = named(f.world.scene, 'village-stop-5-static-BoxGeometry-0');
    const beam = named(f.world.scene, 'village-stop-5-static-BoxGeometry-1');
    expect(coaxial(weight, guide)).toBeGreaterThan(.0049);
    // Foreign: another station's guide is not this weight's guide.
    expect(coaxial(weight, named(f.world.scene, 'village-stop-1-static-BoxGeometry-0'))).toBeLessThan(0);
    expect(coaxial(named(f.world.scene, 'village-9-weight-ExtrudeGeometry-0'), guide)).toBeLessThan(0);
    // Shifted source: weight moved alone, or guide moved alone.
    const hung = original as VillageStation, old = sourceMountLayout(hung, .8, at);
    if (old.guide.kind !== 'hung') throw new Error('unexpected');
    const oldGuide = new Mesh(new BoxGeometry(...old.guide.size).translate(...old.guide.centre)); oldGuide.updateMatrixWorld(true);
    expect(coaxial(weight, oldGuide)).toBeLessThan(0);
    const weightGroup = f.world.scene.getObjectByName('village-5-weight')!, saved = weightGroup.position.clone();
    weightGroup.matrix.elements[12] = old.weight[0]; weightGroup.matrixWorldNeedsUpdate=true; f.world.scene.updateMatrixWorld(true);
    expect(coaxial(weight, guide)).toBeLessThan(0);
    weightGroup.matrix.elements[12] = saved.x; weightGroup.matrixWorldNeedsUpdate=true; f.world.scene.updateMatrixWorld(true);
    // Disconnected: the original beam no longer covers the moved column top;
    // a column dropped by 1 mm leaves the weld plane.
    const shortBeam = new Mesh(new BoxGeometry(...old.beam.size).translate(...old.beam.centre)); shortBeam.updateMatrixWorld(true);
    expect(highest(packedWorld(shortBeam), 0)).toBeLessThan(lowest(packedWorld(guide), 0));
    expect(Object.is(highest(packedWorld(guide), 1) - .001, lowest(packedWorld(beam), 1))).toBe(false);
    // Hung (ungrounded) foot at the new site has no terrain under it.
    const floating = footCoverage(f.world.scene.getObjectByName('village-landscape-1')!, weightGroup.position.x, weightGroup.position.z, old.guide.centre[1] - old.guide.size[1] / 2);
    expect(floating.covered).toBe(0);
    [oldGuide, shortBeam].forEach(m => m.geometry.dispose());
  } finally { f.dispose(); }
});


type Box = { min: Vector3; max: Vector3 };
const grow = (b: Box, d: number, down = d): Box => ({ min: b.min.clone().subScalar(d).setY(b.min.y - down), max: b.max.clone().addScalar(d) });
const boxOf = (points: Vector3[]): Box => ({ min: new Vector3(lowest(points, 0), lowest(points, 1), lowest(points, 2)), max: new Vector3(highest(points, 0), highest(points, 1), highest(points, 2)) });
/** Strict separating-axis overlap of a world triangle and an axis-aligned box. Touching is not overlap. */
function overlaps(t: { a: Vector3; b: Vector3; c: Vector3 }, box: Box): boolean {
  const centre = box.min.clone().add(box.max).multiplyScalar(.5), h = box.max.clone().sub(box.min).multiplyScalar(.5);
  const v = [t.a, t.b, t.c].map(p => p.clone().sub(centre)), e = [v[1]!.clone().sub(v[0]!), v[2]!.clone().sub(v[1]!), v[0]!.clone().sub(v[2]!)];
  const units = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
  for (const axis of [...units, e[0]!.clone().cross(e[1]!), ...units.flatMap(u => e.map(edge => u.clone().cross(edge)))]) {
    if (!(axis.lengthSq() > 0)) continue;
    const p = v.map(q => q.dot(axis)), r = h.x * Math.abs(axis.x) + h.y * Math.abs(axis.y) + h.z * Math.abs(axis.z);
    if (Math.min(...p) >= r || Math.max(...p) <= -r) return false;
  }
  return true;
}

it('diagnoses conservative DESIGN margin boxes against the whole current scene; never a physical guard', () => {
  const f = villageWorld(1, true);
  try {
    const route = f.probe.machine.route; route.requirePhysical();
    const movers = (f.probe.machine as unknown as { movers: { group: Object3D }[] }).movers.map(m => m.group);
    const weightGroup = f.world.scene.getObjectByName('village-5-weight')!;
    const weight = named(f.world.scene, 'village-5-weight-ExtrudeGeometry-0');
    const column = named(f.world.scene, 'village-stop-5-static-BoxGeometry-0'), beam = named(f.world.scene, 'village-stop-5-static-BoxGeometry-1');
    const land = f.world.scene.getObjectByName('village-landscape-1')!, marble = f.probe.marble?.mesh;
    f.world.film(0); f.world.scene.updateMatrixWorld(true);
    const rest = packedWorld(weight); f.world.film(route.duration); f.world.scene.updateMatrixWorld(true);
    // The weight only translates vertically (I3), so its swept hull is the union of its end boxes.
    const swept = boxOf([...rest, ...packedWorld(weight)]), columnBox = boxOf(packedWorld(column)), beamBox = boxOf(packedWorld(beam));
    // Enrolled contacts only: S71-F (column foot on flat land: no downward growth against the landscape),
    // W71 and the weight-top rest contact are all inside the source itself.
    const zones = [{ part: 'weight', box: grow(swept, MARGIN) }, { part: 'column', box: grow(columnBox, MARGIN) }, { part: 'beam', box: grow(beamBox, MARGIN) }];
    const landZones = [{ part: 'weight', box: grow(swept, MARGIN) }, { part: 'column', box: grow(columnBox, MARGIN, 0) }, { part: 'beam', box: grow(beamBox, MARGIN) }];
    // Inherited designed clearance, enrolled by actual identity: stop5's fixed carriage rail has
    // always run .05 in z in front of the weight. It keeps that exact gap; it is never in the margin set.
    const fixedParts = f.probe.machine.staticSolids[5]!.children.filter((o): o is Mesh => o instanceof Mesh);
    const rails = fixedParts.filter(m => { const b = boxOf(packedWorld(m)); return b.min.z > -7.73 && b.max.z < -7.57 && b.max.x - b.min.x > 2 && b.min.y > 5.5 && b.max.y < 5.75; });
    expect(rails.length).toBe(1);
    const rail = rails[0]!, railBox = boxOf(packedWorld(rail)), railGap = railBox.min.z - swept.max.z;
    expect(railGap).toBeGreaterThan(.049); expect(surfaceTriangles(rail).some(t => overlaps(t, swept))).toBe(false);
    const own = new Set<Object3D>([weight, column, beam, rail]), moving = new Set<Object3D>();
    for (const group of movers) group.traverse(o => moving.add(o));
    f.world.film(0); f.world.scene.updateMatrixWorld(true);
    const fixed: { mesh: string; part: string; face: number }[] = [];
    for (const t of surfaceTriangles(f.world.scene)) {
      if (!visible(t.mesh) || own.has(t.mesh) || moving.has(t.mesh) || t.mesh === marble) continue;
      for (const zone of t.mesh === land || t.mesh.parent === land ? landZones : zones) if (overlaps(t, zone.box)) fixed.push({ mesh: t.mesh.name, part: zone.part, face: t.index });
    }
    // Rim post 5 is measured, not assumed: its actual east face is the hand literal and lies a margin west.
    const posts = f.probe.machine.staticSolids[5]!.children.filter((o): o is Mesh => o instanceof Mesh && o.name === 'village-rim-post-5');
    const east = Math.max(...posts.map(post => highest(packedWorld(post), 0)));
    const eastPost = posts.find(post => highest(packedWorld(post), 0) === east)!, eastChild = f.probe.machine.staticSolids[5]!.children.indexOf(eastPost);
    expect(posts.length).toBe(2); expect(east).toBe(POST_EAST_X); expect(lowest(packedWorld(eastPost), 0)).toBe(POST_WEST_X);
    expect(swept.min.x - POST_EAST_X).toBeGreaterThan(MARGIN);
    const motion: { mover: string; part: string; time: number; normal: boolean }[] = [];
    let marbleGap = Infinity;
    const radius = marble ? (marble.geometry.computeBoundingSphere(), marble.geometry.boundingSphere!.radius) : 0, centre = new Vector3();
    const times = new Set([0, route.duration, ...route.contacts.flatMap(c => [c.start, c.contact, c.end])]);
    for (let i = 0; i <= Math.ceil(route.duration * 120); i++) times.add(Math.min(route.duration, i / 120));
    for (const time of [...times].sort((a, b) => a - b)) for (const normal of [true, false]) {
      f.world.film(time, normal); f.world.scene.updateMatrixWorld(true);
      for (const group of movers) {
        if (group === weightGroup) continue;
        group.traverse(o => {
          if (!(o instanceof Mesh) || !visible(o)) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const box = new Box3().copy(o.geometry.boundingBox!).applyMatrix4(o.matrixWorld); // broadphase only
          for (const zone of zones) if (box.min.x < zone.box.max.x && box.max.x > zone.box.min.x && box.min.y < zone.box.max.y && box.max.y > zone.box.min.y && box.min.z < zone.box.max.z && box.max.z > zone.box.min.z)
            for (const t of surfaceTriangles(o)) if (overlaps(t, zone.box)) { motion.push({ mover: o.name, part: zone.part, time, normal }); break; }
        });
      }
      route.sample(time, centre);
      for (const box of [swept, columnBox, beamBox]) marbleGap = Math.min(marbleGap, new Vector3().copy(centre).clamp(box.min, box.max).distanceTo(centre) - radius);
    }
    record('all-scene-margin-diagnostic', { swept: [swept.min.toArray(), swept.max.toArray()], column: [columnBox.min.toArray(), columnBox.max.toArray()], beam: [beamBox.min.toArray(), beamBox.max.toArray()], fixed, motion: motion.slice(0, 200), motionCount: motion.length, marbleGap, postEast: east, eastChild, rail: { child: fixedParts.indexOf(rail), box: [railBox.min.toArray(), railBox.max.toArray()], gap: railGap } });
    // Conservative expanded source boxes: candidates require exact margin refinement; physical guards run separately.
    
    // Sphere-to-expanded-hull clearance is diagnostic; raw sphere guards remain independent.
  } finally { f.dispose(); }
});

it('keeps the rejected source members as actual-post negatives, cheapest first', () => {
  const f = villageWorld(1, true);
  try {
    f.world.film(0); f.world.scene.updateMatrixWorld(true);
    const weight = named(f.world.scene, 'village-5-weight-ExtrudeGeometry-0');
    const posts = surfaceTriangles(f.world.scene).filter(t => t.mesh.name === 'village-rim-post-5' && t.mesh.parent === f.probe.machine.staticSolids[5]);
    const at = (x: number) => {
      const copy = new Mesh(weight.geometry, weight.material); copy.matrixAutoUpdate = false; copy.matrix.copy(weight.matrixWorld);
      copy.matrix.elements[12] = 2.674 + x; copy.matrixWorldNeedsUpdate = true;
      let crossings = 0; for (const a of surfaceTriangles(copy)) for (const b of posts) if (triangleCrossing(a, b) || triangleCrossing(b, a)) crossings++;
      return { x, crossings, gap: lowest(packedWorld(copy), 0) - POST_EAST_X };
    };
    const rows = [1.75, 1.90, 2.00, MOUNT_X].map(at);
    record('post-negatives', rows);
    expect(rows[0]!.crossings).toBeGreaterThan(0); expect(rows[1]!.crossings).toBeGreaterThan(0);
    expect(rows[2]!.crossings).toBe(0); expect(rows[2]!.gap).toBeGreaterThan(0); expect(rows[2]!.gap).toBeLessThan(MARGIN);
    expect(rows[3]!.crossings).toBe(0); expect(rows[3]!.gap).toBeGreaterThan(MARGIN);
  } finally { f.dispose(); }
});

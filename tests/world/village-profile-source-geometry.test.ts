import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { VillageRollingPrefix } from '../../src/world/village-prefix';
import { carriageGuideParts } from '../../src/view/carriage-guide-parts';
import { compileTerrain, terrainHeightAt } from '../../src/world/village-terrain';
import { villageScenePlan } from '../../src/world/village-plans';
import { surfaceTriangles } from './surface-overlap';
import { exposedOverlaps, solidProbes, sphereCollision, sphereSupported, visible } from './village-geometry';
import { profileHardwareCrossings } from './village-profile-joints';
import { villageWorld } from './village-world-fixture';

const chunks=8;
it.each([0,2].flatMap(chapter=>Array.from({length:chunks},(_,chunk)=>({chapter,chunk}))))('chapter $chapter chunk $chunk actual source9 hardware clears ALL scene solids, terrain, exposed faces and sphere', ({chapter,chunk}) => {
  const f = villageWorld(chapter, true);
  try {
    const machine = f.probe.machine, route = machine.route;
    const prefix: unknown = (route as unknown as { prefix?: unknown }).prefix;
    expect(prefix).toBeInstanceOf(VillageRollingPrefix);
    if (!(prefix instanceof VillageRollingPrefix)) throw new Error('Actual cached physical prefix required');
    const motion = prefix.retained.find(m => m.station.stop === 9)!;
    expect(motion).toBeDefined(); expect(motion.station).toBe(route.authoredPlan.stations.find(s => s.stop === 9));
    const contact = route.contacts.find(c => c.stop === 9)!;
    expect(contact.end).toBe(motion.end);
    const parts = carriageGuideParts(motion.station, f.probe.plan.profile)!;
    const caliper = machine.root.getObjectByName('village-carriage-caliper-9') as Mesh;
    const fixedGuide = machine.root.getObjectByName('village-carriage-rail-9') as Mesh;
    const carrier = machine.root.getObjectByName('village-9-carrier')!, fork = machine.root.getObjectByName('village-9-fork')!;
    expect(caliper).toBeInstanceOf(Mesh); expect(fixedGuide).toBeInstanceOf(Mesh);
    try {
      expect(Array.from(caliper.geometry.getAttribute('position').array)).toEqual(Array.from(parts.caliper.getAttribute('position').array));
      expect(Array.from(fixedGuide.geometry.getAttribute('position').array)).toEqual(Array.from(parts.rail!.getAttribute('position').array));
      for (const id of contact.moverIds) expect(machine.root.getObjectByName(id), id).toBeDefined();
      const activeMovers = machine.groups[9]!.children.filter(o => !o.name.endsWith('-static')).map(o => o.name).sort();
      expect(activeMovers).toEqual([...contact.moverIds].sort());
      if(parts.kind==='post-collar'){
        const post=machine.root.getObjectByName('village-rim-post-9')!;
        f.world.film(0);f.world.scene.updateMatrixWorld(true);
        const railBox=new Box3().setFromObject(fixedGuide),postBox=new Box3().setFromObject(post),collarBox=new Box3().setFromObject(caliper);
        const storage=8*2**-24*Math.max(1,Math.abs(railBox.max.y));
        expect(Math.abs(railBox.min.y-postBox.max.y),'standing column flush joint').toBeLessThan(storage);
        expect(railBox.max.y,'top stays within actual collar envelope').toBeLessThanOrEqual(collarBox.max.y+storage);
        expect(railBox.max.y-railBox.min.y).toBeLessThanOrEqual(Math.abs(parts.travel.y)+.2+storage);
      }
      const times = new Set([0, contact.start, contact.contact, contact.end,
        ...route.transfers.filter(t => t.stop === 9).flatMap(t => [0, .25, .5, .75, 1].map(u => t.start + (t.end - t.start) * u))]);
      for (let i = 0; i <= Math.ceil(contact.end * 120); i++) times.add(Math.min(contact.end, i / 120));
      const center = new Vector3(), normal = new Vector3(), whole = new Box3(), bounds = new Box3(), swept = new Box3();
      const terrain = compileTerrain(villageScenePlan(chapter).terrain);
      const probes = solidProbes(f.world.scene, .3).filter(p => p.mesh !== f.probe.marble?.mesh);
      let checked = 0;const checkedTimes:number[]=[];
      for (const reduced of [false, true]) for (const [index,time] of [...times].sort((a,b)=>a-b).entries()) {
        if(index%chunks!==chunk)continue;
        f.world.film(time, !reduced); f.world.scene.updateMatrixWorld(true);
        machine.sample(time, center); normal.setFromMatrixColumn(carrier.matrixWorld,1).normalize();
        expect(sphereCollision(probes, center, .3), `sphere chapter=${chapter}, time=${time}, reduced=${reduced}`).toBeNull();
        expect(sphereSupported(probes, center, normal, .3), `support time=${time}`).toBe(true);
        const ground = terrainHeightAt(terrain, center.x, center.z);
        if (ground !== undefined) expect(center.y - .3).toBeGreaterThanOrEqual(ground - .002);
        const surfaces = surfaceTriangles(f.world.scene).filter(s => visible(s.mesh) && s.mesh !== f.probe.marble?.mesh);
        const hardware = surfaces.filter(s => s.mesh.parent === carrier && !s.mesh.name.startsWith('village-track-') || s.mesh.parent === fork ||
          s.mesh.name === 'village-carriage-rail-9' || s.mesh.name === 'village-rim-post-9' || s.mesh.name === 'village-rim-brace-9');
        expect(hardware.some(s => s.mesh === caliper)).toBe(true); expect(hardware.some(s => s.mesh === fixedGuide)).toBe(true);
        const crossings=profileHardwareCrossings(hardware,surfaces);
        if(crossings.length)writeFileSync(`output/current/village-layouts/parallel44/kernel/crossings-${chapter}.json`,JSON.stringify({time,reduced,crossings},null,2));
        expect(crossings, `all-solids time=${time}, reduced=${reduced}`).toEqual([]);
        const region = new Box3(); for (const face of hardware) region.union(face.bounds);
        const overlaps = exposedOverlaps(surfaces.filter(s => s.bounds.intersectsBox(region))).filter(o => hardware.includes(o.a) || hardware.includes(o.b));
        expect(overlaps.map(o => ({ a: o.a.mesh.name, b: o.b.mesh.name, at: o.point.toArray(), area: o.area })), `exposed time=${time}`).toEqual([]);
        machine.contactBounds(9, bounds); machine.bounds(whole);
        for (const face of surfaces.filter(s => s.mesh === fixedGuide || s.mesh.parent === carrier || s.mesh.parent === fork || s.mesh.name === 'village-9-weight')) {
          for (const p of [face.a, face.b, face.c]) { expect(bounds.containsPoint(p), `contact bounds ${face.mesh.name}`).toBe(true); expect(whole.containsPoint(p)).toBe(true); swept.expandByPoint(p); }
        }
        // Opposed *rendered* finite guide/jaw patches, at the compiled pose.
        const pose = { localX: 0, progress: 0, forkX: 0, forkAngle: 0, forkLift: 0, weightDrop: 0 }; motion.state(time, pose);
        const travel = parts.travel.clone().multiplyScalar(pose.progress * pose.progress * (3 - 2 * pose.progress));
        for (const axis of [parts.normal, parts.across]) for (const sign of [-1, 1]) for (const along of [-parts.contactHalfLength, 0, parts.contactHalfLength]) {
          const origin = parts.origin.clone().add(travel).addScaledVector(parts.tangent, along), ray = new Ray(origin, axis.clone().multiplyScalar(sign)), hit = new Vector3();
          const nearest = (mesh: Mesh) => {
            let distance = Infinity, n = new Vector3();
            for (const face of surfaceTriangles(mesh)) if (ray.intersectTriangle(face.a, face.b, face.c, false, hit)) {
              const d = hit.distanceTo(origin); if (d < distance) { distance = d; n = face.normal; }
            }
            return { distance, normal: n };
          };
          const a = nearest(caliper), b = nearest(fixedGuide);
          expect(Math.abs(a.distance - b.distance)).toBeLessThan(2e-6); expect(a.normal.dot(b.normal)).toBeLessThan(-.99999);
        }
        checked++;checkedTimes.push(time);
      }
      expect(checked).toBe([...times].filter((_t,i)=>i%chunks===chunk).length*2);
      writeFileSync(`output/current/village-layouts/parallel44/kernel/geometry-${chapter}-chunk-${chunk}.json`,JSON.stringify({chapter,chunk,chunks,checked,allTimes:[...times].sort((a,b)=>a-b),checkedTimes},null,2)+'\n');
      // Catch double-anchor transforms and needlessly huge follow envelopes.
      machine.contactBounds(9, bounds);
      const actualSize = swept.getSize(new Vector3()), envelope = bounds.getSize(new Vector3());
      expect(envelope.x).toBeLessThan(actualSize.x + 3); expect(envelope.y).toBeLessThan(actualSize.y + 3); expect(envelope.z).toBeLessThan(actualSize.z + 3);
      const before = carrier.matrix.toArray(); machine.contactBounds(9, bounds); machine.bounds(whole); expect(carrier.matrix.toArray()).toEqual(before);
    } finally { parts.caliper.dispose(); parts.rail?.dispose(); }
  } finally { f.dispose(); }
}, 240000);

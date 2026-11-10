import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Mesh, Quaternion, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { villageWorld } from './village-world-fixture';

it('keeps the complete Gardens trajectory, geometry, names, visibility and poses exact', () => {
  const f = villageWorld(1, true);
  try {
    const route = f.probe.machine.route; route.requirePhysical();
    const geometry = createHash('sha256'), trajectory = createHash('sha256'), poses = createHash('sha256');
    const geometryUpdate = (value: unknown) => geometry.update(JSON.stringify(value));
    let meshes = 0;
    f.world.scene.traverse(object => {
      geometryUpdate({ name: object.name, type: object.type, parent: object.parent?.name, visible: object.visible, auto: object.matrixAutoUpdate });
      if (!(object instanceof Mesh)) return;
      meshes++;
      for (const name of Object.keys(object.geometry.attributes).sort()) {
        const a = object.geometry.getAttribute(name); geometryUpdate({ name, itemSize: a.itemSize, normalized: a.normalized, count: a.count });
        const array = a.array; geometry.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
      }
      const index = object.geometry.index;
      if (index) geometry.update(new Uint8Array(index.array.buffer, index.array.byteOffset, index.array.byteLength));
    });
    const routeHash = createHash('sha256').update(JSON.stringify({ plan: route.plan, authored: route.authoredPlan,
      contacts: route.contacts, transfers: route.transfers, segments: route.segments, boundaries: route.boundaries,
      handoff: route.handoff, ledger: route.physicalLedger, duration: route.duration })).digest('hex');
    const times = new Set([0, route.duration, ...route.contacts.flatMap(c => [c.start, c.contact, c.end]),
      ...route.transfers.flatMap(t => [0, .25, .5, .75, 1].map(u => t.start + (t.end - t.start) * u))]);
    for (let i = 0; i <= Math.ceil(route.duration * 120); i++) times.add(Math.min(route.duration, i / 120));
    const center = new Vector3(), orientation = new Quaternion();
    for (const reduced of [false, true]) for (const time of [...times].sort((a, b) => a - b)) {
      f.world.film(time, !reduced); f.world.scene.updateMatrixWorld(true);
      f.probe.machine.sample(time, center); f.probe.machine.marbleOrientation(time, orientation);
      trajectory.update(JSON.stringify({ reduced, time, position: center.toArray(), orientation: orientation.toArray() }));
      f.world.scene.traverse(object => poses.update(JSON.stringify({ reduced, time, name: object.name,
        visible: object.visible, matrix: object.matrix.toArray(), world: object.matrixWorld.toArray() })));
      poses.update(JSON.stringify({ camera: f.world.camera.matrixWorld.toArray(), projection: f.world.camera.projectionMatrix.toArray() }));
    }
    const result = { duration: route.duration, meshes, times: times.size, modes: 2, route: routeHash,
      geometry: geometry.digest('hex'), trajectory: trajectory.digest('hex'), poses: poses.digest('hex') };
    const output = process.env.TW_KERNEL_FINGERPRINT;
    if (output) writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    if (process.env.TW_KERNEL_COMPARE) expect(result).toEqual(JSON.parse(readFileSync(process.env.TW_KERNEL_COMPARE, 'utf8')));
    expect(result.duration).toBe(33.87939035586543);
  } finally { f.dispose(); }
}, 120000);

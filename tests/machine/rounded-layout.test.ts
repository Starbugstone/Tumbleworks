import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BeltPath } from '../../src/engine/belt-path';
import {
  BOX, FUNNEL, MARBLE_RADIUS, RACEWAY, RIDE_Y, SLOT_PITCH, TICK_SECONDS,
  conveyorTrack, dockDistanceFor, dockX, entryDistanceFor,
} from '../../src/machine/layout';
import { FUNNEL_ISLAND_BOARDS } from '../../src/sim/island-boards';
import { transferRails } from '../../src/view/dispatch-plate';
import { funnelChute, funnelFeed, funnelTransferPose } from '../../src/view/funnel-transfer';

const radius = MARBLE_RADIUS;
const halfWidth = RACEWAY.channelHalf + RACEWAY.wallThickness;
const wallTop = RACEWAY.floorY + RACEWAY.wallHeight;
const samples = 512;
const jitter = [-RACEWAY.jitter, RACEWAY.jitter];

function wallDistance(track: BeltPath, { x, y, z }: { x: number; y: number; z: number }): number {
  const lateral = Math.abs(track.nearest(x, z).lateral);
  return Math.hypot(Math.max(0, RACEWAY.channelHalf - lateral, lateral - halfWidth),
    Math.max(0, y - wallTop, RACEWAY.floorY - y));
}

const layoutCases = [
  { id: 'short delta', trackShape: 'delta', beltCapacity: 16, docks: 3 },
  { id: 'long delta', trackShape: 'delta', beltCapacity: 20, docks: 3 },
  { id: 'bean with outside shoes', trackShape: 'kidney', beltCapacity: 22, docks: 3 },
  ...FUNNEL_ISLAND_BOARDS.filter(board => board.trackShape === 'delta' || board.trackShape === 'kidney')
    .map(board => ({ ...board, docks: board.docks.length })),
] as const;

for (const board of layoutCases) describe(board.id, () => {
  const path = conveyorTrack(board.trackShape, board.beltCapacity);
  const { length } = path;
  const entry = entryDistanceFor(path);

  it('closes an exact lap of slots with room for the full wall strips and neighbouring marbles', () => {
    expect(length).toBeCloseTo(board.beltCapacity * SLOT_PITCH, 10);
    const points = Array.from({ length: samples }, (_, i) => path.point(i / samples * length));
    let rimError = 0, remoteGap = Infinity, riderGap = Infinity;
    for (let i = 0; i < samples; i++) {
      const d = i / samples * length;
      const p = points[i]!;
      for (const offset of [-halfWidth, halfWidth]) {
        const edge = path.point(d, offset);
        const projection = path.nearest(edge.x, edge.z);
        const error = Math.abs(projection.distance - d);
        rimError = Math.max(rimError, Math.min(error, length - error), Math.abs(projection.lateral - offset));
      }
      for (let j = i + 1; j < samples; j++) {
        const along = Math.min(j - i, samples - (j - i)) / samples * length;
        if (along < 1.9) continue;
        const q = points[j]!;
        remoteGap = Math.min(remoteGap, Math.hypot(p.x - q.x, p.z - q.z));
      }
      for (const a of jitter) for (const b of jitter) {
        const first = path.point(d, a);
        const next = path.point(d + SLOT_PITCH, b);
        riderGap = Math.min(riderGap, Math.hypot(first.x - next.x, first.z - next.z));
      }
    }
    // Offsets must round-trip to their own cross-section even around the inside fillet.
    expect(rimError).toBeLessThan(1e-7);
    expect(remoteGap - 2 * length / samples).toBeGreaterThan(2 * halfWidth);
    expect(riderGap).toBeGreaterThan(2 * radius);
  });

  it('keeps the feed lip and the arriving marble clear of both raised belt walls', () => {
    const feed = funnelFeed(path, entry);
    const top = new THREE.Vector3().copy(feed.top);
    const bottom = new THREE.Vector3().copy(feed.bottom);
    const rotate = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), bottom.clone().sub(top).normalize());
    let lipGap = Infinity, dropGap = Infinity;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const angle = t * Math.PI * 2;
      const outer = FUNNEL.chuteRadius + .02;
      const ring = new THREE.Vector3(outer * Math.cos(angle), 0, outer * Math.sin(angle)).applyQuaternion(rotate).add(bottom);
      lipGap = Math.min(lipGap, wallDistance(path, ring));
      for (const offset of jitter) {
        const land = path.point(entry, offset);
        const marble = new THREE.Vector3(0, FUNNEL.neckY - radius * .4, FUNNEL.neck.z);
        marble.lerp(new THREE.Vector3(land.x, RIDE_Y, land.z), t);
        dropGap = Math.min(dropGap, wallDistance(path, marble));
      }
    }
    expect(lipGap).toBeGreaterThan(.06); // Lip tube radius .05 plus clearance.
    expect(dropGap).toBeGreaterThan(radius + .01);
  });

  it('keeps each complete cast shoe outside the belt and each delivery arc above the rim', () => {
    let shoeGap = Infinity, deliveryGap = Infinity, priorDock = -Infinity;
    for (let dock = 0; dock < board.docks; dock++) {
      const x = dockX(dock, board.docks);
      const d = dockDistanceFor(path, x);
      const passesAfterEntry = (d - entry + length) % length;
      expect(passesAfterEntry).toBeGreaterThan(priorDock);
      priorDock = passesAfterEntry;
      const chute = funnelChute(path, x);
      expect(chute.nose.x).toBe(x);
      expect(chute.length).toBeGreaterThan(.15);
      for (const geometry of transferRails(path, x)) {
        const positions = geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
          const point = path.nearest(positions.getX(i), positions.getZ(i));
          shoeGap = Math.min(shoeGap, point.lateral - halfWidth);
        }
        geometry.dispose();
      }
      const marble = new THREE.Vector3();
      for (const offset of jitter) for (const pocket of [-1, 0, 1]) {
        const target = { x: x + pocket * BOX.slotSpacing, y: BOX.floorThickness + radius, z: BOX.z };
        for (let tick = 0; tick <= 5; tick++) {
          const launch = path.point(d + RACEWAY.speed * TICK_SECONDS * tick / 5, offset);
          for (let i = 0; i <= 160; i++) {
            funnelTransferPose(chute, { ...launch, y: RIDE_Y }, target, i / 160, marble);
            deliveryGap = Math.min(deliveryGap, wallDistance(path, marble));
          }
        }
      }
    }
    expect(shoeGap).toBeGreaterThan(.02);
    expect(deliveryGap).toBeGreaterThan(radius + .01);
  });
});

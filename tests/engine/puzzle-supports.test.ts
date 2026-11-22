import * as THREE from 'three';
import { expect, it } from 'vitest';
import { BOX, MARBLE_RADIUS, RIDE_Y, conveyorTrack, dockX } from '../../src/machine/layout';
import { BOARDS } from '../../src/sim/boards';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { tubeRack } from '../../src/puzzles/tube-rack';
import { counterGeometry } from '../../src/view/board-counter';
import { funnelChute, funnelTransferPose } from '../../src/view/funnel-transfer';
import { transferRails } from '../../src/view/dispatch-plate';

const testSurface = new THREE.Mesh();
const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
function heightAt(geometry: THREE.BufferGeometry, x: number, z: number): number {
  testSurface.geometry = geometry;
  ray.ray.origin.set(x, 12, z);
  return ray.intersectObject(testSurface, false)[0]?.point.y ?? -Infinity;
}

it('seats every tube foot on the lit facet of the island worktop, including the authored racks', () => {
  for (const board of TUBE_BOARDS) {
    const rack = tubeRack(board);
    const geometry = counterGeometry(rack.halfWidth, rack.back, rack.front, .185);
    for (const { x, z } of rack.places) for (const offset of [-.76, .76]) {
      expect(heightAt(geometry, x + offset, z), board.id).toBeCloseTo(.185, 4);
    }
    expect(heightAt(geometry, rack.halfWidth + 2, 0)).toBeLessThan(-.9);
    geometry.dispose();
  }
});

it('runs the actual landing path on the chute floor, between the cast lips, for every Funnel layout', () => {
  const layouts = new Map(BOARDS.map(board => [
    [board.trackShape ?? 'oval', board.beltCapacity, board.docks.length].join('/'), board,
  ]));
  for (const board of layouts.values()) {
    const track = conveyorTrack(board.trackShape, board.beltCapacity);
    board.docks.forEach((_, i) => {
      const x = dockX(i, board.docks.length);
      const chute = funnelChute(track, x);
      const from = { ...chute.outlet, y: chute.outlet.y + RIDE_Y };
      const rails = transferRails(track, x);
      const pose = new THREE.Vector3();
      const to = { x, y: BOX.floorThickness + MARBLE_RADIUS, z: BOX.z };
      for (const t of [.345, .4, .54, .615]) {
        funnelTransferPose(chute, from, to, t, pose);
        const floor = heightAt(rails[0]!, pose.x, pose.z);
        expect((pose.y-floor) / Math.sqrt(1+.12**2), board.id).toBeCloseTo(MARBLE_RADIUS, 4);
        for (const side of [-1,1]) expect(heightAt(rails[side < 0 ? 1 : 2]!,
          pose.x + side * .44 * Math.cos(chute.yaw), pose.z - side * .44 * Math.sin(chute.yaw))).toBeGreaterThan(floor);
      }
      for (const slot of [-1, 0, 1]) {
        to.x = x + slot * BOX.slotSpacing;
        funnelTransferPose(chute, from, to, 1, pose);
        expect(pose.toArray()).toEqual([to.x, expect.closeTo(to.y, 6), to.z]);
      }
      for (const rail of rails) rail.dispose();
    });
  }
});

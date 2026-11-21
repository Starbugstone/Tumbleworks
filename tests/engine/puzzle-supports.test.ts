import * as THREE from 'three';
import { expect, it } from 'vitest';
import { BOX, RACEWAY, conveyorTrack, dockX } from '../../src/machine/layout';
import { BOARDS } from '../../src/sim/boards';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { tubeRack } from '../../src/puzzles/tube-rack';
import { counterGeometry } from '../../src/view/board-counter';
import { transferRails } from '../../src/view/dispatch-plate';

function heightAt(geometry: THREE.BufferGeometry, x: number, z: number): number {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 2, z), new THREE.Vector3(0, -1, 0));
  return ray.intersectObject(new THREE.Mesh(geometry))[0]?.point.y ?? -Infinity;
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

it('joins the rendered belt pickup to every dock without intruding into the marble flight', () => {
  for (const board of BOARDS) {
    const track = conveyorTrack(board.trackShape, board.beltCapacity);
    board.docks.forEach((_, i) => {
      const x = dockX(i, board.docks.length), z = BOX.z - .42;
      const from = track.point(track.nearest(x, RACEWAY.centerZ + RACEWAY.radius).distance);
      const rails = transferRails(track, x);
      for (const t of [.001, .5, .999]) {
        expect(heightAt(rails[0]!, from.x + t * (x - from.x), from.z + t * (z - from.z)), board.id).toBeCloseTo(-.10, 4);
      }
      for (const rail of rails) {
        rail.computeBoundingBox();
        expect(rail.boundingBox!.max.y).toBeLessThan(Math.min(RACEWAY.floorY, BOX.floorThickness));
        rail.dispose();
      }
    });
  }
});

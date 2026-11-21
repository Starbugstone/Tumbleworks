import * as THREE from 'three';
import { type Track } from '../machine/layout';
import { funnelChute } from './funnel-transfer';
import type { Color } from '../sim/types';
import { COLORS, decal } from './art';
import { ARCADE, bodyPlastic, fuse, plate, tinted } from './arcade';

export interface DispatchLane { x: number; z: number; halfWidth: number; halfDepth: number; color: Color }

class DispatchPlates extends THREE.Group {
  showExcept(occupied: ReadonlySet<number>): void {
    this.children.forEach((plate, lane) => { plate.visible = !occupied.has(lane); });
  }
}

/** An emptied bay keeps the print of its last shipment beside the winning load. */
export function dispatchPlates(lanes: readonly DispatchLane[], top: number, prints = new Map<Color, THREE.MeshBasicMaterial>()): DispatchPlates {
  const group = new DispatchPlates();
  const enamel = bodyPlastic();
  for (const { halfWidth: w, halfDepth: d, x, z, color } of lanes) {
    const r = Math.min(w * .67, d * .64);
    const medallion = new THREE.CylinderGeometry(r, r * 1.03, .06, 32);
    const parts = [
      plate(w, d, .08, .075, .18, .025, ARCADE.trim),
      plate(w - .06, d - .06, .11, .033, .15, .012, ARCADE.lane),
      tinted(medallion.translate(0, .14, 0), COLORS[color].hex),
      tinted(new THREE.TorusGeometry(r * .95, .038, 5, 32).rotateX(-Math.PI / 2).translate(0, .18, 0), ARCADE.rim),
    ];
    if (d > r * 1.65) for (const side of [-1, 1]) {
      parts.push(tinted(new THREE.BoxGeometry(w * 1.08, .026, .055).translate(0, .13, side * (r + d) / 2), ARCADE.rim));
    }
    const bay = new THREE.Mesh(fuse(parts), enamel);
    bay.position.set(x, top, z);
    const print = decal(color, r * 1.64, prints);
    print.rotation.x = -Math.PI / 2;
    print.position.y = .178;
    bay.add(print);
    group.add(bay);
  }
  group.visible = false;
  group.name = 'completed-dispatch-bays';
  return group;
}

/** A high-contrast no-entry sign across a jammed throat leaves the box's cargo pattern exposed. */
export function jamShutter(x: number, y: number, z: number, width: number): THREE.Mesh {
  const cream = 0xfff1ce;
  const radius = Math.min(.48, width * .35);
  const parts = [
    plate(width / 2, .10, .12, .12, .075, .022, ARCADE.edge),
    tinted(new THREE.CylinderGeometry(radius, radius, .09, 8).rotateY(Math.PI / 8).translate(0, .16, 0), cream),
    tinted(new THREE.CylinderGeometry(radius * .85, radius * .85, .035, 8).rotateY(Math.PI / 8).translate(0, .22, 0), ARCADE.edge),
    tinted(new THREE.BoxGeometry(radius * 1.14, .026, radius * .32).translate(0, .249, 0), cream),
  ];
  const mesh = new THREE.Mesh(fuse(parts), bodyPlastic());
  mesh.name = 'blocked-intake';
  mesh.position.set(x, y, z);
  mesh.visible = false;
  return mesh;
}

/** A dark runway and two cast lips sit on a bracket. Its pitch and endpoints also drive the marble. */
export function transferRails(track: Pick<Track, 'nearest' | 'point'>, x: number): THREE.BufferGeometry[] {
  const { head, nose, length, yaw } = funnelChute(track, x);
  const centerX = (head.x + nose.x) / 2, centerZ = (head.z + nose.z) / 2;
  const centerY = (head.y + nose.y) / 2;
  const pitch = Math.atan2(head.y - nose.y, length), face = Math.hypot(length, head.y - nose.y);
  // Three dimensional local coordinates keep the running surface and its lips precisely parallel.
  const strip = (width: number, height: number, side: number, above: number, color: number) => {
    const part = new THREE.BoxGeometry(width, height, face);
    part.translate(side, above, 0).rotateX(pitch).rotateY(yaw).translate(centerX, centerY, centerZ);
    return tinted(part, color);
  };
  const bracket = new THREE.BoxGeometry(.32, centerY + .22, Math.max(.10, length * .40));
  bracket.rotateY(yaw).translate(centerX, (centerY - .22) / 2, centerZ);
  return [
    strip(.84, .13, 0, -.065, ARCADE.lane),
    strip(.095, .19, -.44, .005, ARCADE.shell),
    strip(.095, .19, .44, .005, ARCADE.shell),
    tinted(bracket, ARCADE.trim),
  ];
}

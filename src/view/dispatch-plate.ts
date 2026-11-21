import * as THREE from 'three';
import { BOX, RACEWAY, type Track } from '../machine/layout';
import { ARCADE, bodyPlastic, fuse, plate, tinted } from './arcade';

export interface DispatchLane { x: number; z: number; halfWidth: number; halfDepth: number; color: number }

/** A finished bay exposes an enamel dispatch plate. A raised ivory tick stays readable on every cargo colour. */
export function dispatchPlates(lanes: readonly DispatchLane[], top: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  for (const lane of lanes) {
    const { halfWidth: w, halfDepth: d, x, z } = lane;
    const r = Math.min(w * .67, d * .64);
    parts.push(plate(w, d, top+.08, .075, .18, .025, ARCADE.trim, z).translate(x,0,0));
    parts.push(plate(w-.06, d-.06, top+.11, .033, .15, .012, ARCADE.lane, z).translate(x,0,0));
    const medallion = new THREE.CylinderGeometry(r, r*1.03, .06, 36);
    parts.push(tinted(medallion.translate(x,top+.14,z),lane.color));
    parts.push(tinted(new THREE.TorusGeometry(r*.95,.038,5,36).rotateX(-Math.PI/2).translate(x,top+.18,z), ARCADE.rim));
    const mark = new THREE.Shape();
    mark.moveTo(-.58,-.03); mark.lineTo(-.19,-.43); mark.lineTo(.64,.40);
    mark.lineTo(.48,.55); mark.lineTo(-.19,-.13); mark.lineTo(-.43,.12); mark.closePath();
    const check = new THREE.ExtrudeGeometry(mark,{depth:.02,bevelEnabled:false}).scale(r,r,1).rotateX(-Math.PI/2);
    parts.push(tinted(check.translate(x,top+.174,z),0xfff4d8));
    if (d > r * 1.65) for (const sign of [-1,1]) {
      parts.push(tinted(new THREE.BoxGeometry(w*1.08,.026,.055).translate(x,top+.13,z+sign*(r+d)/2),ARCADE.rim));
      parts.push(tinted(new THREE.BoxGeometry(w*.72,.026,.035).translate(x,top+.13,z+sign*((r+d)/2+.16)),ARCADE.shell));
    }
  }
  const mesh = new THREE.Mesh(fuse(parts),bodyPlastic());
  mesh.visible = false; mesh.name = 'completed-dispatch-bays';
  return mesh;
}

/** This shutter drops only at a blocked intake; the diagonal ivory flutes read on every cargo colour. */
export function jamShutter(x: number, y: number, z: number, width: number): THREE.Mesh {
  const parts = [plate(width/2,.14,.08,.10,.09,.025,ARCADE.edge)];
  for (let i = -1; i <= 1; i++) {
    parts.push(tinted(new THREE.BoxGeometry(width*.14,.19,.028).rotateX(-Math.PI/2).rotateY(.44)
      .translate(i*width*.22,.102,0),0xffe6b1));
  }
  const mesh = new THREE.Mesh(fuse(parts), bodyPlastic());
  mesh.name = 'blocked-intake'; mesh.position.set(x,y,z); mesh.visible=false;
  return mesh;
}


/** The belt-to-box throat sits below the marble's flight and touches both physical assemblies. */
export function transferRails(track: Pick<Track, 'nearest' | 'point'>, x: number): THREE.BufferGeometry[] {
  const outlet = track.point(track.nearest(x, RACEWAY.centerZ + RACEWAY.radius).distance);
  const z = BOX.z - .42;
  const dx = x - outlet.x, dz = z - outlet.z;
  const length = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const pieces = [
    { offset: 0, width: .71, y: -.19, color: ARCADE.lane },
    { offset: -.36, width: .13, y: -.104, color: ARCADE.shell },
    { offset: .36, width: .13, y: -.104, color: ARCADE.shell },
  ];
  return pieces.map(({ offset, width, y, color }) => {
    const rail = new THREE.BoxGeometry(width, .18, length);
    rail.rotateY(yaw).translate((outlet.x + x) / 2 + Math.cos(yaw) * offset, y,
      (outlet.z + z) / 2 - Math.sin(yaw) * offset);
    return tinted(rail, color);
  });
}

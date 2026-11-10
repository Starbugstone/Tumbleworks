import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORKSHOP_BUILDING, workshopSwing, type WorkshopSignPlacement } from '../world/workshop-building';

/** The bracket is baked into the village; only the single medallion mesh moves. */
export class WorkshopBuilding {
  readonly fixed = new THREE.Group();
  readonly sign = new THREE.Group();
  private readonly owned: THREE.BufferGeometry[] = [];

  constructor(material: THREE.Material, placement: WorkshopSignPlacement = { pivot: WORKSHOP_BUILDING.pivot, yaw: 0, scale: 1 }) {
    const { drop, radius, thickness } = WORKSHOP_BUILDING;
    const { pivot, yaw, scale } = placement;
    this.fixed.name = 'workshop-sign-bracket'; this.sign.name = 'workshop-hammer-sign';
    this.fixed.position.set(pivot.x, pivot.y, pivot.z); this.sign.position.copy(this.fixed.position);
    this.fixed.rotation.y = this.sign.rotation.y = yaw;
    this.fixed.scale.setScalar(scale); this.sign.scale.setScalar(scale);
    const color = (geometry: THREE.BufferGeometry, hex: number): THREE.BufferGeometry => {
      geometry.deleteAttribute('uv'); const rgb = new THREE.Color(hex);
      const values = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let index = 0; index < values.length; index += 3) rgb.toArray(values, index);
      geometry.setAttribute('color', new THREE.BufferAttribute(values, 3)); return geometry;
    };
    const bracket = color(new THREE.BoxGeometry(0.07, 0.07, 0.68).translate(0, 0, -0.31), 0x234e50);
    this.owned.push(bracket); this.fixed.add(new THREE.Mesh(bracket, material));
    // Head and handle share one silhouette, so their front and back have no doubled patch.
    const angle = -0.35, head = new THREE.Vector2(0.04, 0.12).rotateAround(new THREE.Vector2(), -angle);
    const left = head.x - 0.12, right = head.x + 0.12, bottom = head.y - 0.0425, top = head.y + 0.0425;
    const outline = new THREE.Shape([
      new THREE.Vector2(-0.0225, -0.125), new THREE.Vector2(0.0225, -0.125),
      new THREE.Vector2(0.0225, bottom), new THREE.Vector2(right, bottom), new THREE.Vector2(right, top),
      new THREE.Vector2(left, top), new THREE.Vector2(left, bottom), new THREE.Vector2(-0.0225, bottom),
    ]);
    const hammer = new THREE.ExtrudeGeometry(outline, { depth: 0.025, bevelEnabled: false, steps: 1, curveSegments: 1 });
    hammer.setIndex(Array.from({ length: hammer.getAttribute('position').count }, (_, index) => index));
    hammer.translate(0, 0, -0.0125).rotateZ(angle).translate(-0.015, -drop - 0.025, thickness / 2 + 0.014);
    const parts = [
      color(new THREE.CylinderGeometry(radius, radius, thickness, 20).rotateX(Math.PI / 2).translate(0, -drop, 0), 0x234e50),
      color(new THREE.BoxGeometry(0.035, 0.28, 0.035).translate(0, -0.14, 0), 0x234e50),
      color(hammer, 0xffedca),
    ];
    const merged = mergeGeometries(parts); parts.forEach(part => part.dispose());
    if (!merged) throw new Error('Could not merge Workshop sign');
    this.owned.push(merged); this.sign.add(new THREE.Mesh(merged, material));
  }
  apply(seconds: number, passSeconds: number, reduced = false): void { this.sign.rotation.z = workshopSwing(seconds, passSeconds, reduced); }
  reset(): void { this.sign.rotation.z = 0; }
  dispose(): void { this.fixed.removeFromParent(); this.sign.removeFromParent(); this.owned.forEach(geometry => geometry.dispose()); }
}

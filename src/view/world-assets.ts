import * as THREE from 'three';
import terrainRaw from '../../assets/world-3d/terrain-runtime.json?raw';
import { parseWorldAsset, WorldKitAssets } from './world-kit';

export { registerWorldKit } from './world-kit';
const terrain = parseWorldAsset(terrainRaw);

/** Preserved authored terrain for the original machine's geometry regressions. */
export class WorldAssets extends WorldKitAssets {
  readonly anchors: readonly THREE.Vector3[] = terrain.anchors.map(point => new THREE.Vector3().fromArray(point));
  readonly badges: readonly THREE.Vector3[] = terrain.badges.map(point => new THREE.Vector3().fromArray(point));
  terrain(material: THREE.Material): THREE.Group { return this.group(terrain, terrain.meshes, material); }
}

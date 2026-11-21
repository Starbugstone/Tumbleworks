import * as THREE from 'three';
import kitRaw from '../../assets/world-3d/kit-runtime.json?raw';

export interface AssetMesh {
  name: string; model: string; part: string; pivot: number[];
  positions: number[]; normals: number[]; colors: number[]; indices: number[];
}
export interface Asset {
  positionScale: number; normalScale: number; palette: number[][];
  anchors: number[][]; badges: number[][]; meshes: AssetMesh[];
}
function fail(): never { throw new Error('Invalid Blender world mesh asset'); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
function numbers(value: unknown): number[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'number' && Number.isFinite(item))) return fail();
  return value;
}
function vectors(value: unknown): number[][] {
  if (!Array.isArray(value)) return fail();
  return value.map(item => { const vector = numbers(item); if (vector.length !== 3) return fail(); return vector; });
}
function stream(value: unknown, packed: boolean, kind: 'position' | 'normal' | 'color' | 'uint16' | 'uint32'): number[] {
  if (!packed) return numbers(value);
  if (typeof value !== 'string') return fail();
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const width = kind === 'uint32' ? 4 : kind === 'position' || kind === 'uint16' ? 2 : 1;
  if (bytes.length % width) return fail();
  return Array.from({ length: bytes.length / width }, (_, index) => {
    const offset = index * width;
    switch (kind) {
      case 'position': return view.getInt16(offset, true);
      case 'normal': return view.getInt8(offset);
      case 'color': return view.getUint8(offset);
      case 'uint16': return view.getUint16(offset, true);
      case 'uint32': return view.getUint32(offset, true);
    }
  });
}
export function parseWorldAsset(raw: string): Asset {
  const source = record(JSON.parse(raw));
  if (source.version !== 1 || (source.encoding !== undefined && source.encoding !== 'base64-le')) return fail();
  const { positionScale, normalScale } = source;
  if (typeof positionScale !== 'number' || !Number.isFinite(positionScale) || positionScale <= 0 ||
      typeof normalScale !== 'number' || !Number.isFinite(normalScale) || normalScale <= 0) return fail();
  const palette = vectors(source.palette);
  if (!Array.isArray(source.meshes)) return fail();
  const meshes = source.meshes.map((value): AssetMesh => {
    const mesh = record(value); const packed = source.encoding === 'base64-le';
    if (typeof mesh.name !== 'string' || (mesh.indexType !== undefined && mesh.indexType !== 'uint16' && mesh.indexType !== 'uint32')) return fail();
    const positions = stream(mesh.positions, packed, 'position');
    const normals = stream(mesh.normals, packed, 'normal');
    const colors = stream(mesh.colors, packed, 'color');
    const indices = stream(mesh.indices, packed, mesh.indexType === 'uint32' ? 'uint32' : 'uint16');
    if (positions.length !== colors.length * 3 || normals.length !== positions.length || indices.length % 3 ||
        !indices.every(index => Number.isInteger(index) && index >= 0 && index < colors.length) ||
        !colors.every(color => Number.isInteger(color) && color >= 0 && color < palette.length) ||
        (mesh.vertexCount !== undefined && mesh.vertexCount !== colors.length) ||
        (mesh.indexCount !== undefined && mesh.indexCount !== indices.length)) return fail();
    const pivot = mesh.pivot === undefined ? [0, 0, 0] : numbers(mesh.pivot);
    if (pivot.length !== 3) return fail();
    return { name: mesh.name, model: typeof mesh.model === 'string' ? mesh.model : mesh.name,
      part: typeof mesh.part === 'string' ? mesh.part : mesh.name, pivot, positions, normals, colors, indices };
  });
  return { positionScale, normalScale, palette, meshes,
    anchors: vectors(source.anchors ?? []), badges: vectors(source.badges ?? []) };
}
let kit: Asset | undefined = parseWorldAsset(kitRaw);
export function registerWorldKit(raw: string): void { kit = parseWorldAsset(raw); }

/** A turned timber tower with painted bands and a twelve-sided lantern. */
function harbourBeacon(): THREE.BufferGeometry {
  const section = [[.86, 0], [.86, .20], [.70, .30], [.63, 1.18], [.57, 1.92], [.51, 2.65],
    [.69, 2.70], [.69, 2.82], [.46, 2.88], [.46, 3.38], [.67, 3.42], [0, 3.94]];
  const lathe = new THREE.LatheGeometry(section.map(([r, y]) => new THREE.Vector2(r, y)), 12);
  const mesh = lathe.toNonIndexed();
  lathe.dispose();
  const points = mesh.getAttribute('position');
  const colors = new Float32Array(points.count * 3);
  for (let i = 0; i < points.count; i += 3) {
    const y = (points.getY(i) + points.getY(i + 1) + points.getY(i + 2)) / 3;
    const pane = Math.floor(i / (6 * (section.length - 1)));
    let paint = 0xf1dbaf;
    if (y <= .25 || (y >= 2.65 && y <= 2.88) || y >= 3.38) paint = 0x354754;
    else if (y > 1.18 && y < 1.92) paint = 0xb94636;
    else if (y > 2.88) paint = pane % 3 === 0 ? 0x455664 : 0xffbe60;
    const color = new THREE.Color(paint);
    for (let j = i; j < i + 3; j++) color.toArray(colors, j * 3);
  }
  mesh.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  mesh.deleteAttribute('uv');
  return mesh;
}

/** Geometry belongs to one scene; repeated village pieces share it only inside that scene. */
export class WorldKitAssets {
  constructor(private readonly tropical = false, private readonly harbour = false) {}
  private readonly geometries = new Map<AssetMesh, THREE.BufferGeometry>();
  private beacon?: THREE.BufferGeometry;
  /** Names exported by the village asset kit. */
  get modelNames(): readonly string[] { return [...new Set(kit?.meshes.map(mesh => mesh.model) ?? [])]; }
  model(name: string, material: THREE.Material): THREE.Group {
    const group = kit ? this.group(kit, kit.meshes.filter(mesh => mesh.model === name), material) : new THREE.Group();
    if (name === 'harbour-beacon') group.add(new THREE.Mesh(this.beacon ??= harbourBeacon(), material));
    group.name = name;
    return group;
  }
  protected group(asset: Asset, meshes: readonly AssetMesh[], material: THREE.Material): THREE.Group {
    const group = new THREE.Group();
    for (const source of meshes) {
      let geometry = this.geometries.get(source);
      if (!geometry) {
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(source.positions.map(value => value / asset.positionScale), 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(source.normals.map(value => value / asset.normalScale), 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(source.colors.flatMap(index => {
          if (this.tropical && ['house-a', 'house-b', 'warehouse'].includes(source.model)) {
            const paint: Record<number, number> = { 0: 0xf7e9c7, 1: 0xe7bb86, 7: source.model === 'warehouse' ? 0x398d8c : 0x329b9c };
            if (this.harbour && index === 7) paint[index] = source.model === 'warehouse' ? 0xa54e3b : 0x496778;
            if (paint[index] !== undefined) return new THREE.Color(paint[index]).toArray();
          }
          return asset.palette[index]!;
        }), 3));
        geometry.setIndex(source.indices);
        geometry.computeBoundingSphere();
        this.geometries.set(source, geometry);
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = source.part;
      mesh.position.fromArray(source.pivot);
      group.add(mesh);
    }
    return group;
  }
  dispose(): void { this.beacon?.dispose(); this.beacon = undefined; this.geometries.forEach(geometry => geometry.dispose()); this.geometries.clear(); }
}

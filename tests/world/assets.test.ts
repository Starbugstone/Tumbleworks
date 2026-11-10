import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { registerWorldKit, WorldAssets } from '../../src/view/world-assets';

const fixture = () => ({ version: 1, positionScale: 1000, normalScale: 127, palette: [[0.1, 0.2, 0.3]], meshes: [{
  name: 'wheel-rotor', model: 'wheel', part: 'rotor', pivot: [2, 3, 4],
  positions: [-1000, 0, 0, 1000, 0, 0, 0, 1000, 0], normals: [0, 0, 127, 0, 0, 127, 0, 0, 127],
  colors: [0, 0, 0], indices: [0, 1, 2],
}] });
function first(group: THREE.Group): THREE.Mesh {
  const mesh = group.children[0];
  if (!(mesh instanceof THREE.Mesh)) throw new Error('Expected authored mesh');
  return mesh;
}
describe('Blender world asset ownership and decoding', () => {
  it('reuses geometry within one scene while keeping another scene independent', () => {
    registerWorldKit(JSON.stringify(fixture()));
    const left = new WorldAssets(); const right = new WorldAssets();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const a = first(left.model('wheel', material)); const b = first(left.model('wheel', material));
    const other = first(right.model('wheel', material));
    expect(a.geometry).toBe(b.geometry); expect(a.geometry).not.toBe(other.geometry);
    expect(a.material).toBe(material); expect(a.name).toBe('rotor'); expect(a.position.toArray()).toEqual([2, 3, 4]);
    expect(a.geometry.getAttribute('position').getX(0)).toBe(-1);
    expect(a.geometry.getAttribute('normal').getZ(0)).toBe(1);
    expect(a.geometry.getAttribute('color').getY(0)).toBeCloseTo(0.2);
    const ownDispose = vi.fn(); const otherDispose = vi.fn(); const materialDispose = vi.fn();
    a.geometry.addEventListener('dispose', ownDispose); other.geometry.addEventListener('dispose', otherDispose);
    material.addEventListener('dispose', materialDispose);
    left.dispose(); expect(ownDispose).toHaveBeenCalledOnce(); expect(otherDispose).not.toHaveBeenCalled(); expect(materialDispose).not.toHaveBeenCalled();
    right.dispose(); material.dispose();
  });
  it('decodes signed little-endian packed streams and keeps missing models empty', () => {
    const original = fixture(); const source = original.meshes[0]!;
    const encode = (values: number[], bytes: number, signed: boolean): string => {
      const buffer = Buffer.alloc(values.length * bytes);
      values.forEach((value, index) => signed ? buffer.writeIntLE(value, index * bytes, bytes) : buffer.writeUIntLE(value, index * bytes, bytes));
      return buffer.toString('base64');
    };
    registerWorldKit(JSON.stringify({ ...original, encoding: 'base64-le', meshes: [{ ...source,
      positions: encode(source.positions, 2, true), normals: encode(source.normals, 1, true),
      colors: encode(source.colors, 1, false), indices: encode(source.indices, 2, false), indexType: 'uint16',
    }] }));
    const assets = new WorldAssets(); const material = new THREE.MeshBasicMaterial();
    expect(first(assets.model('wheel', material)).geometry.getAttribute('position').getX(0)).toBe(-1);
    expect(assets.modelNames).toEqual(['wheel']); expect(assets.model('missing', material).children).toHaveLength(0);
    expect(assets.anchors).toHaveLength(10); expect(assets.badges).toHaveLength(10);
    expect(assets.terrain(material).children).toHaveLength(2);
    assets.dispose(); material.dispose();
  });
  it('rejects invalid vertex counts, out-of-range indices and non-finite coordinates', () => {
    const badCount = fixture(); badCount.meshes[0]!.normals.pop();
    const badIndex = fixture(); badIndex.meshes[0]!.indices[0] = 3;
    const badPosition = fixture(); badPosition.meshes[0]!.positions[0] = Infinity;
    for (const bad of [badCount, badIndex, badPosition]) expect(() => registerWorldKit(JSON.stringify(bad))).toThrow('Invalid Blender');
  });
});

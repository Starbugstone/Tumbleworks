import * as THREE from 'three';

/** Sky colours by height on the dome, bottom to top: a dusky floor bounce up to a pale ceiling. */
const DOME: readonly (readonly [number, number])[] = [[-1, 0x8a7a70], [-0.2, 0x7f78b4], [0.3, 0x93a6f2], [1, 0xe6edff]];

/**
 * The studio every toy is lit in: a gradient dome, one large softbox overhead and two smaller cards.
 * A glossy marble shows one broad clean highlight and a warm underside, and nothing is paid per frame:
 * the scene is drawn once into the prefiltered environment and thrown away.
 */
export function studioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  const dome = new THREE.SphereGeometry(40, 32, 16);
  const position = dome.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const low = new THREE.Color(), high = new THREE.Color();
  for (let index = 0; index < position.count; index++) {
    const height = position.getY(index) / 40;
    const upper = Math.max(1, DOME.findIndex(([at]) => at >= height));
    const [from, fromHex] = DOME[upper - 1]!, [to, toHex] = DOME[upper]!;
    low.setHex(fromHex).lerp(high.setHex(toHex), (height - from) / (to - from)).toArray(colors, index * 3);
  }
  dome.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const card = (width: number, height: number, color: number, power: number, x: number, y: number, z: number): void => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };
  // The softbox hangs where the key light shines from, so the lamp's glint and the box's glow are one highlight.
  card(18, 13, 0xffffff, 10, -7, 29, 9);
  card(5, 22, 0xc4d4ff, 3, 26, 9, -8);
  card(34, 5, 0xffd6ad, 1.6, 0, -7, 26);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, 0.03).texture;
  pmrem.dispose();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    (object.material as THREE.Material).dispose();
  });
  return texture;
}

import * as THREE from 'three';

/**
 * Clear plastic seen from both sides. Three draws a double-sided transparent material in two passes and
 * flags the material for a shader rebuild before each one, on every frame. Two fixed one-sided meshes draw
 * the same picture without that cost: the back one is created first, so at equal depth it sorts first, as
 * three's own back-then-front passes do. Flat glass shows one side at a time and needs a single pass.
 */
export class Glass<T extends THREE.Material = THREE.Material> {
  readonly back: T;
  readonly front: T;
  /** For flat pieces only: one double-sided pass is the same picture when no pixel sees both faces. */
  readonly flat: T;

  constructor(material: T) {
    this.front = material;
    this.back = material.clone() as T;
    this.flat = material.clone() as T;
    this.front.side = THREE.FrontSide;
    this.back.side = THREE.BackSide;
    this.flat.side = THREE.DoubleSide;
    this.flat.forceSinglePass = true;
  }

  mesh(geometry: THREE.BufferGeometry, renderOrder = 0): THREE.Group {
    const group = new THREE.Group();
    for (const material of [this.back, this.front]) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = renderOrder;
      group.add(mesh);
    }
    return group;
  }
}

/** A pair of narrow studio-window reflections on the moulded glass. The projection
 * responds to the angle of each pane and stays on the pane above moving cargo. */
export function workshopGlass(material: THREE.MeshStandardMaterial): Glass<THREE.MeshStandardMaterial> {
  const glass = new Glass(material);
  for (const pane of [glass.front, glass.back, glass.flat]) {
    pane.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 reflected = reflect(-normalize(vViewPosition), normal);
        float windowX = reflected.x + reflected.y * .18;
        float broad = 1.0 - smoothstep(.035, .12, abs(windowX + .40));
        float mullion = 1.0 - smoothstep(.008, .024, abs(windowX + .22));
        float highlight = max(broad * .68, mullion * .65);
        float edge = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0);
        outgoingLight += vec3(.50, .69, .72) * highlight;
        diffuseColor.a = clamp(diffuseColor.a * (.55 + .60 * edge) + .16 * highlight, 0.0, .65);
        #include <opaque_fragment>`);
    };
  }
  return glass;
}

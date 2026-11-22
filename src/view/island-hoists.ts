import * as THREE from 'three';
import type { VillageProfile, VillageVec3 } from '../world/village-plan';

/**
 * Headframes for the two island lifts drawn on the `brine` and `stoneware` profiles. They are fixed
 * scenery around the real lift: the sheave sits on the actual pulley beam between the carrier's
 * guide post and the counterweight guide, so the frame reads as the hoist that moves the marble.
 * Everything stands in a plane behind the post, the collar's travel and the weight, and the legs
 * meet the drawn terrain over their whole foot.
 */
export interface HoistPart { readonly name: string; readonly geometry: THREE.BufferGeometry; readonly color: number }
export interface HoistSite {
  /** Carrier guide post, at the lift anchor's x, in the source plane. */
  readonly post: readonly [x: number, z: number];
  /** Counterweight guide x, in the same plane. */
  readonly guideX: number;
  /** Top of the pulley beam the sheave stands over. */
  readonly beamTop: number;
  /** Back faces of everything that moves in the shaft (collar, weight), so the frame stands clear behind it. */
  readonly movingBack: number;
}
type Ground = (x: number, z: number) => number | undefined;

const SHEAVE_RADIUS = .5, SHEAVE_GAP = .08, SHEAVE_THICKNESS = .08;

/** A rectangular member from `a` to `b`; with `ground`, the four vertices of its `a` end sit on the terrain. */
function member(a: VillageVec3, b: VillageVec3, width: number, depth: number, ground?: Ground): THREE.BufferGeometry {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), axis = to.clone().sub(from), length = axis.length();
  const geometry = new THREE.BoxGeometry(width, length, depth).translate(0, length / 2, 0);
  const foot = Array.from({ length: geometry.getAttribute('position').count }, (_, i) => geometry.getAttribute('position').getY(i) < length / 2);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()));
  geometry.translate(from.x, from.y, from.z);
  if (ground) {
    const p = geometry.getAttribute('position'), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      if (!foot[i]) continue;
      v.fromBufferAttribute(p, i);
      const height = ground(v.x, v.z);
      if (height === undefined) throw new Error('Hoist foot crosses a void');
      if (height >= to.y) throw new Error('Hoist member is buried in terrain');
      p.setY(i, height);
    }
    geometry.computeVertexNormals();
  }
  return geometry;
}

/** A vertical block from the terrain under its whole footprint to `top`. */
function column(x: number, z: number, width: number, depth: number, top: number, ground: Ground): THREE.BufferGeometry {
  const lowest = Math.min(...[-1, 1].flatMap(i => [-1, 1].map(j => {
    const height = ground(x + i * width / 2, z + j * depth / 2);
    if (height === undefined) throw new Error('Hoist pier crosses a void');
    return height;
  })));
  if (lowest >= top) throw new Error('Hoist pier is buried in terrain');
  return member([x, lowest, z], [x, top, z], width, depth, ground);
}

/** A grooved iron sheave facing the camera, its axle reaching back into the head beam. */
function sheave(centre: VillageVec3, axleBack: number, rim: number, spokes: number): HoistPart[] {
  const r = SHEAVE_RADIUS, t = SHEAVE_THICKNESS / 2;
  const profile = [[r * .78, -t], [r, -t], [r * .9, 0], [r, t], [r * .78, t], [r * .78, -t]].map(([x, y]) => new THREE.Vector2(x, y));
  const wheel = new THREE.LatheGeometry(profile, 18).rotateX(Math.PI / 2).translate(...centre);
  const parts: HoistPart[] = [{ name: 'sheave', geometry: wheel, color: rim }];
  for (let k = 0; k < 3; k++) {
    // Each spoke sits at its own depth, so the three never share a face plane where they cross at the hub.
    const spoke = new THREE.BoxGeometry(r * 1.6, .07, SHEAVE_THICKNESS * .5).rotateZ(k * Math.PI / 3)
      .translate(centre[0], centre[1], centre[2] + (k - 1) * .014);
    parts.push({ name: `spoke-${k}`, geometry: spoke, color: spokes });
  }
  const back = centre[2] - t;
  const axle = new THREE.CylinderGeometry(.07, .07, back + .1 - axleBack, 10).rotateX(Math.PI / 2)
    .translate(centre[0], centre[1], (back + .1 + axleBack) / 2);
  parts.push({ name: 'axle', geometry: axle, color: 0x3f4647 });
  return parts;
}

/** Saltmere Pans: a splayed headframe of tarred posts with bleached braces, on dike-stone sole pads. */
function brineHeadframe(site: HoistSite, ground: Ground): HoistPart[] {
  const TAR = 0x3b3631, BLEACHED = 0xc9bc9e, STONE = 0x8c877a;
  const z = site.movingBack - .3, [postX] = site.post;
  const left = postX - .5, right = site.guideX + .5, splay = .45;
  const centre: VillageVec3 = [(postX + site.guideX) / 2, site.beamTop + SHEAVE_GAP + SHEAVE_RADIUS, site.post[1]];
  const head = centre[1] + .05, footY = (x: number) => { const y = ground(x, z); if (y === undefined) throw new Error('Hoist foot crosses a void'); return y; };
  const parts: HoistPart[] = [];
  for (const [name, top, foot] of [['leg-left', left, left - splay], ['leg-right', right, right + splay]] as const) {
    parts.push({ name: `${name}-pad`, geometry: column(foot, z, .42, .4, footY(foot) + .12, ground), color: STONE });
    parts.push({ name, geometry: member([foot, footY(foot), z], [top, head, z], .2, .2, ground), color: TAR });
  }
  // The head beam carries the sheave axle; the leg tops end inside it.
  parts.push({ name: 'head-beam', geometry: new THREE.BoxGeometry(right - left + .5, .24, .26).translate((left + right) / 2, head, z), color: BLEACHED });
  // A mid girt and one pair of crossed braces stiffen the lower half; the braces pass at different depths.
  const at = (y: number, side: -1 | 1) => { const top = side < 0 ? left : right, foot = top + side * splay, base = footY(foot);
    return foot + (top - foot) * (y - base) / (head - base); };
  const girt = (head + footY(left)) * .5;
  parts.push({ name: 'girt', geometry: new THREE.BoxGeometry(at(girt, 1) - at(girt, -1) + .1, .16, .14).translate((left + right) / 2, girt, z), color: BLEACHED });
  const low = footY(left) + .55;
  parts.push({ name: 'brace-a', geometry: member([at(low, -1), low, z + .035], [at(girt, 1), girt, z + .035], .12, .1), color: BLEACHED });
  parts.push({ name: 'brace-b', geometry: member([at(low, 1), low, z - .035], [at(girt, -1), girt, z - .035], .12, .1), color: BLEACHED });
  parts.push(...sheave(centre, z, 0x4d5657, BLEACHED));
  return parts;
}

/** Potters' Reach: two brick piers with a dark plinth, glazed stoneware bands and caps, and a lintel. */
function stonewareHeadframe(site: HoistSite, ground: Ground): HoistPart[] {
  const BRICK = 0x84432f, PLINTH = 0x5e3428, STONEWARE = 0xd8c6a0, GLAZE = 0x537986;
  const z = site.movingBack - .32, [postX] = site.post;
  const left = postX - .85, right = site.guideX + .65, width = .4;
  const centre: VillageVec3 = [(postX + site.guideX) / 2, site.beamTop + SHEAVE_GAP + SHEAVE_RADIUS, site.post[1]];
  const lintel = centre[1] + .02, parts: HoistPart[] = [];
  for (const [side, x] of [['left', left], ['right', right]] as const) {
    const base = ground(x, z) ?? 0;
    parts.push({ name: `pier-${side}`, geometry: column(x, z, width, width, lintel, ground), color: BRICK });
    parts.push({ name: `plinth-${side}`, geometry: column(x, z, width + .16, width + .16, base + .7, ground), color: PLINTH });
    for (const [k, y] of [base + (lintel - base) * .4, base + (lintel - base) * .72].entries())
      parts.push({ name: `band-${side}-${k}`, geometry: new THREE.BoxGeometry(width + .08, .12, width + .08).translate(x, y, z), color: STONEWARE });
    parts.push({ name: `cap-${side}`, geometry: new THREE.BoxGeometry(width + .14, .14, width + .14).translate(x, lintel + .3, z), color: GLAZE });
  }
  // The stoneware lintel spans the piers and holds the sheave axle; the pier tops end inside it.
  parts.push({ name: 'lintel', geometry: new THREE.BoxGeometry(right - left + width + .06, .32, width - .04).translate((left + right) / 2, lintel + .08, z), color: STONEWARE });
  parts.push(...sheave(centre, z, 0x4d5657, STONEWARE));
  return parts;
}

export function islandHoist(profile: VillageProfile, site: HoistSite, ground: Ground): readonly HoistPart[] | undefined {
  if (profile === 'brine') return brineHeadframe(site, ground);
  if (profile === 'stoneware') return stonewareHeadframe(site, ground);
  return undefined;
}

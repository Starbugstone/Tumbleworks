import { BoxGeometry, ExtrudeGeometry, Path, Shape } from 'three';
import type { VillageStation, VillageVec3 } from '../world/village-plan';

export const WEIGHT_GUIDE_WIDTH = .035;

/** The fixed square guide passes through a real bore, with 5 mm side clearance.
 * The source's declared mass is unchanged; its motion is vertical translation.
 */
export function counterweightGeometry(): ExtrudeGeometry {
  const half = .19, bore = WEIGHT_GUIDE_WIDTH / 2 + .005;
  const outline = new Shape();
  outline.moveTo(-half, -half); outline.lineTo(half, -half);
  outline.lineTo(half, half); outline.lineTo(-half, half); outline.closePath();
  const passage = new Path();
  passage.moveTo(-bore, -bore); passage.lineTo(-bore, bore);
  passage.lineTo(bore, bore); passage.lineTo(bore, -bore); passage.closePath();
  outline.holes.push(passage);
  return new ExtrudeGeometry(outline, { depth: .5, bevelEnabled: false, steps: 1 })
    .rotateX(Math.PI / 2).translate(0, .25, 0);
}

export type SourceGuide =
  | { readonly kind: 'hung'; readonly centre: VillageVec3; readonly size: VillageVec3 }
  | { readonly kind: 'grounded'; readonly x: number; readonly z: number; readonly bottom: number; readonly top: number };
export interface SourceMountLayout {
  readonly weight: VillageVec3;
  readonly guide: SourceGuide;
  readonly beam: { readonly centre: VillageVec3; readonly size: VillageVec3 };
}

/** One owner for the fixed weight, guide and pulley-beam placement. Without
 * `sourceMount` this is the original arithmetic, expression for expression. A
 * mount moves the WHOLE source east: the weight axis, its guide, now a column
 * on one flat land patch, and the beam, whose west end stays at -.15 while its
 * east end keeps the original .15 overhang past the guide. The column top is the
 * same value the beam bottom packs to; its foot is the terrain's packed height.
 */
export function sourceMountLayout(station: VillageStation, drive: number, ground: (x: number, z: number) => number | undefined): SourceMountLayout {
  const a = station.anchor, m = station.mechanism, z = a[2] - (station.retention ? .96 : .9);
  const uprightRetained = station.retention && 'travel' in m && typeof m.travel !== 'number' && m.travel[0] === 0 && m.travel[2] === 0;
  const depth = station.retention ? uprightRetained ? .18 : .3 : .12, mount = station.sourceMount;
  if (!mount) {
    const weight: VillageVec3 = [a[0] + 1.2, a[1] + 2, z], length = drive + 0.5;
    return { weight, guide: { kind: 'hung', centre: [weight[0], weight[1] - length / 2, weight[2]], size: [WEIGHT_GUIDE_WIDTH, length + 0.5, WEIGHT_GUIDE_WIDTH] },
      beam: { centre: [a[0] + 0.6, a[1] + 2.3, z], size: [1.5, 0.1, depth] } };
  }
  if (!station.retention || mount.guide !== 'grounded' || !Number.isFinite(mount.x) || !(mount.x > 0)) throw new Error(`Stop ${station.stop}: source mount needs a retained weight, a grounded guide and a finite eastward x`);
  const weight: VillageVec3 = [a[0] + mount.x, a[1] + 2, z], half = WEIGHT_GUIDE_WIDTH / 2, top = weight[1] + .25;
  const foot = [[0, 0], [-half, -half], [half, -half], [-half, half], [half, half]].map(([dx, dz]) => ground(weight[0] + dx!, z + dz!));
  const bottom = foot[0];
  if (bottom === undefined || !Number.isFinite(bottom) || foot.some(height => height !== bottom)) throw new Error(`Stop ${station.stop}: grounded source guide needs one flat land patch under its whole foot`);
  if (!(weight[1] - drive - .25 > bottom)) throw new Error(`Stop ${station.stop}: source weight stroke reaches its foot`);
  return { weight, guide: { kind: 'grounded', x: weight[0], z, bottom, top },
    beam: { centre: [a[0] + mount.x / 2, a[1] + 2.3, z], size: [mount.x + .3, 0.1, depth] } };
}

/** Same twelve-triangle box as the hung guide; only its vertex heights differ. */
export function groundedGuideGeometry(guide: Extract<SourceGuide, { kind: 'grounded' }>,ground?:(x:number,z:number)=>number|undefined): BoxGeometry {
  const geometry = new BoxGeometry(WEIGHT_GUIDE_WIDTH, 1, WEIGHT_GUIDE_WIDTH), p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {const x=p.getX(i)+guide.x,z=p.getZ(i)+guide.z,bottom=ground?ground(x,z):guide.bottom;if(bottom===undefined)throw Error('Source guide footprint crosses a void');p.setXYZ(i,x,p.getY(i)>0?guide.top:bottom,z);}
  if(ground)geometry.computeVertexNormals();
  p.needsUpdate = true;
  return geometry;
}

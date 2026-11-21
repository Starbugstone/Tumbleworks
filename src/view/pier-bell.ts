import { BoxGeometry, BufferAttribute, BufferGeometry, LatheGeometry, Matrix4, Mesh, SphereGeometry, Vector2, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PIER_HINGE = new Vector3(-.49, .06, -.93);
// The mallet first touches the faceted lip at this angle. The contact test brackets it on the rendered mesh.
const rest = .40, contact = -.40328719;

export function pierBellShell(): BufferGeometry {
  const section = [[.12,1.22],[.22,1],[.32,.92],[.39,.90],[.38,.97],[.24,1.08],[.19,1.26],[.14,1.40],[.10,1.54]];
  return new LatheGeometry(section.map(([r,y])=>new Vector2(r,y)),16).translate(.42,0,-.93);
}

export function pierHammerGeometry(): BufferGeometry {
  const h=PIER_HINGE;
  const arm=new BoxGeometry(.09,.85,.095).translate(h.x,h.y+.425,h.z);
  const head=new SphereGeometry(.145,9,5).scale(1.10,.88,.85).translate(h.x,h.y+.96,h.z);
  const joined=mergeGeometries([arm,head])!;
  const geometry=joined.toNonIndexed();
  joined.dispose();head.dispose();arm.dispose();
  return geometry;
}

/** One sprung hammer on the back cheek of the terminal shoe. Its travel lies outside the open channel. */
export function hammerAngle(seconds: number, seat: number, strike: number): number {
  if (seconds <= seat) return rest;
  if (seconds < strike) {
    const phase = (seconds - seat) / (strike - seat);
    return rest + (contact - rest) * phase * phase;
  }
  const t = Math.min(1, (seconds - strike) / .64);
  return contact + (rest - contact) * (1 - (1-t)**2 * Math.cos(t * 7));
}

/** The hammer occupies a span of the already drawn terminal mesh. Capture and transform the original
 * coordinates for absolute-time playback, including replays that seek backwards. */
export class PierHammer {
  private readonly points: BufferAttribute;
  private readonly normals: BufferAttribute;
  private geometry?: BufferGeometry;
  private first = 0;
  private angle = NaN;
  private readonly v = new Vector3();
  private readonly turn = new Matrix4();
  private readonly toPivot = new Matrix4().makeTranslation(PIER_HINGE.x,PIER_HINGE.y,PIER_HINGE.z);
  private readonly fromPivot = this.toPivot.clone().invert();
  constructor(private readonly source: Mesh) {
    this.points = source.geometry.getAttribute('position').clone() as BufferAttribute;
    this.normals = source.geometry.getAttribute('normal').clone() as BufferAttribute;
  }
  bind(mesh: BufferGeometry, offset: number): void {
    this.geometry = mesh; this.first = offset; this.angle = NaN;
  }
  pose(angle: number): void {
    if (this.angle === angle) return;
    this.angle = angle;
    this.turn.makeRotationZ(angle);
    if (!this.geometry) {
      this.source.matrixAutoUpdate=false;
      this.source.matrix.multiplyMatrices(this.toPivot,this.turn).multiply(this.fromPivot);
      this.source.matrixWorldNeedsUpdate=true;
      return;
    }
    const vertices = this.geometry.getAttribute('position') as BufferAttribute, normals = this.geometry.getAttribute('normal') as BufferAttribute;
    for (let i=0;i<this.points.count;i++) {
      this.v.fromBufferAttribute(this.points,i).sub(PIER_HINGE).applyMatrix4(this.turn).add(PIER_HINGE);
      vertices.setXYZ(this.first+i,this.v.x,this.v.y,this.v.z);
      this.v.fromBufferAttribute(this.normals,i).applyMatrix4(this.turn);
      normals.setXYZ(this.first+i,this.v.x,this.v.y,this.v.z);
    }
    for (const attribute of [vertices,normals]) {
      attribute.addUpdateRange(this.first*3,this.points.count*3); attribute.needsUpdate=true;
    }
  }
}

import { Matrix4, Ray, Triangle, Vector3, type BufferGeometry } from 'three';
import { carriageGuideParts, type CarriageGuideParts } from '../view/carriage-guide-parts';
import type { VillageProfile, VillageStation, VillageVec3 } from './village-plan';
import { VillageAdmissibilityError } from './village-contact';

export interface GuideReaction {
  readonly offset: VillageVec3;
  readonly normal: VillageVec3;
  readonly magnitude: number;
}
export interface GuideWrench {
  readonly force: VillageVec3;
  readonly moment: VillageVec3;
}
const certified = new WeakSet<CarriageBrake>();
const fixedCertified = new WeakSet<CarriageBrake>();

/** Contact normals span all transverse forces and all three moments. The
 * tangential component is supplied separately by the bounded, dissipative shoe.
 * These are feasible ideal-rigid reactions, not measured bearing preload/yield.
 */
export class CarriageBrake {
  private constructor(readonly stop: number, readonly kind: CarriageGuideParts['kind'], readonly capacity: number,
    readonly origin: VillageVec3, readonly tangent: VillageVec3, readonly normal: VillageVec3, readonly across: VillageVec3,
    readonly halfNormal: number, readonly halfAcross: number, readonly halfLength: number) {
    certified.add(this); Object.freeze(this);
  }
  static enrol(station: VillageStation, profile: VillageProfile): CarriageBrake | undefined {
    const parts = carriageGuideParts(station, profile);
    if (!parts) return;
    try {
      assertGuideContacts(station.stop, parts);
      const t = parts.tangent, n = parts.normal, b = new Vector3().crossVectors(t, n);
      const brake=new CarriageBrake(station.stop, parts.kind, parts.capacity,
        Object.freeze(parts.origin.toArray()), Object.freeze(t.toArray()), Object.freeze(n.toArray()), Object.freeze(b.toArray()),
        parts.halfNormal, parts.halfAcross, parts.contactHalfLength);
      if(parts.rail)fixedCertified.add(brake);return brake;
    } finally { parts.caliper.dispose(); parts.rail?.dispose(); }
  }
  static fixedSideCertified(candidate:unknown,stop:number):candidate is CarriageBrake {
    return CarriageBrake.certified(candidate,stop)&&fixedCertified.has(candidate);
  }
  /** Opt-in post-collar ONLY: the actual Scene post closes the previous fixed-
   * side omission. No guide/post geometry is manufactured or moved here. */
  certifyRenderedPost(station:VillageStation,profile:VillageProfile,post:BufferGeometry,postWorld:Matrix4,collar:BufferGeometry,collarRest:Matrix4):void {
    if(station.retention?.opening!=='captive-leaf'||this.kind!=='post-collar'||station.stop!==this.stop)throw new VillageAdmissibilityError(this.stop,'captive-fixed-post','unsupported-contact-geometry',1,0,'Wrong opt-in/guide ownership');
    const source=carriageGuideParts(station,profile);if(!source||source.kind!=='post-collar')throw new Error('Missing actual collar producer');
    try{
      const same=(a:ArrayLike<number>,b:ArrayLike<number>)=>a.length===b.length&&Array.from(a).every((v,i)=>Object.is(v,b[i]));
      if(!source.frame.equals(collarRest)||!same(source.caliper.getAttribute('position').array,collar.getAttribute('position').array)||!!source.caliper.index!==!!collar.index||source.caliper.index&&!same(source.caliper.index.array,collar.index!.array))throw new Error('Actual collar/matrix differs from compiled source');
      const p=collar.getAttribute('position'),q=post.getAttribute('position'),magnitude=Math.max(1,...Array.from(p.array,Math.abs),...Array.from(q.array,Math.abs),...this.origin.map(Math.abs));
      const bound=2**-24*(magnitude*6+3*new Vector3(...this.origin).length())+64*Number.EPSILON*magnitude;
      const fixed=faces(post,postWorld),normal=new Vector3(),hit=new Vector3(),ray=new Ray(),t=new Vector3(...this.tangent),n=new Vector3(...this.normal),b=new Vector3(...this.across),travel=source.travel;
      for(const progress of[0,.5,1]){
        const movingFrame=collarRest.clone();movingFrame.setPosition(new Vector3().setFromMatrixPosition(collarRest).addScaledVector(travel,progress));const moving=faces(collar,movingFrame);
        for(const[axis,extent,lateral,other]of[[n,this.halfNormal,b,this.halfAcross],[b,this.halfAcross,n,this.halfNormal]]as const)for(const sign of[-1,1])for(const along of[-this.halfLength,0,this.halfLength])for(const side of[-.5,0,.5]){
          const origin=new Vector3(...this.origin).addScaledVector(travel,progress).addScaledVector(t,along).addScaledVector(lateral,side*other),direction=axis.clone().multiplyScalar(sign);ray.set(origin,direction);
          for(const[triangles,expected]of[[moving,-1],[fixed,1]]as const){let nearest=Infinity,dot=0;for(const triangle of triangles)if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit)){const d=hit.distanceTo(origin);if(d<nearest){nearest=d;dot=triangle.getNormal(normal).dot(direction);}}
            if(Math.abs(nearest-extent)>bound||expected*dot<.99999)throw new VillageAdmissibilityError(this.stop,'captive-fixed-post','unsupported-contact-geometry',Math.abs(nearest-extent),bound,'Actual packed post/collar faces do not oppose over the full stroke');}
        }
      }
      fixedCertified.add(this);
    }finally{source.caliper.dispose();source.rail?.dispose();}
  }
  supports(stop: number): boolean { return certified.has(this) && this.stop === stop; }
  static certified(candidate: unknown, stop: number): candidate is CarriageBrake {
    return candidate instanceof CarriageBrake && certified.has(candidate) && candidate.stop === stop;
  }

}

function faces(geometry: BufferGeometry, matrix: Matrix4): Triangle[] {
  const vertices = geometry.getAttribute('position'), index = geometry.index, triangles: Triangle[] = [];
  for (let i = 0; i < (index?.count ?? vertices.count); i += 3) triangles.push(new Triangle(
    ...[0, 1, 2].map(j => new Vector3().fromBufferAttribute(vertices, index ? index.getX(i + j) : i + j).applyMatrix4(matrix)) as [Vector3, Vector3, Vector3]));
  return triangles;
}

/** The only positional bound here is coordinate-storage error: each Float32
 * coordinate rounds by at most u*|x|; rigid transforms propagate it by their
 * row sums. This does not change a collision or force tolerance.
 */
export function assertGuideContacts(stop: number, parts: CarriageGuideParts): void {
  const triangles = faces(parts.caliper, parts.frame), p = parts.caliper.getAttribute('position');
  let localMagnitude = 0;
  for (let i = 0; i < p.count; i++) localMagnitude = Math.max(localMagnitude, Math.abs(p.getX(i)) + Math.abs(p.getY(i)) + Math.abs(p.getZ(i)));
  const storageError = 2 ** -24 * (localMagnitude * Math.sqrt(3) + 3 * parts.origin.length())
    + 64 * Number.EPSILON * Math.max(1, parts.origin.length());
  const guide = parts.rail ? faces(parts.rail, new Matrix4()) : undefined;
  const ray = new Ray(), hit = new Vector3(), normal = new Vector3();
  for (const [axis, distance, lateral] of [[parts.normal, parts.halfNormal, parts.across], [parts.across, parts.halfAcross, parts.normal]] as const) {
    for (const sign of [-1, 1]) for (const along of [-parts.contactHalfLength, 0, parts.contactHalfLength]) for (const side of [-.5, 0, .5]) {
      const otherExtent = axis === parts.normal ? parts.halfAcross : parts.halfNormal;
      ray.set(parts.origin.clone().addScaledVector(parts.tangent, along).addScaledVector(lateral, side * otherExtent), axis.clone().multiplyScalar(sign));
      let closest = Infinity, dot = 1;
      for (const triangle of triangles) if (ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit)) {
        const d = hit.distanceTo(ray.origin);
        if (d < closest) { closest = d; dot = triangle.getNormal(normal).dot(ray.direction); }
      }
      if (Math.abs(closest - distance) > storageError || dot > -.99999) throw new VillageAdmissibilityError(stop, 'carry-guide-contact',
        'unsupported-contact-geometry', Math.abs(closest - distance), storageError, 'Actual opposed guide surface missing or separated');
      if (guide) for (const progress of [0, 1]) {
        const origin = ray.origin.clone().addScaledVector(parts.travel, progress);
        ray.set(origin, axis.clone().multiplyScalar(sign));
        let fixedDistance = Infinity, fixedDot = -1;
        for (const triangle of guide) if (ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit)) {
          const d = hit.distanceTo(origin);
          if (d < fixedDistance) { fixedDistance = d; fixedDot = triangle.getNormal(normal).dot(ray.direction); }
        }
        if (Math.abs(fixedDistance - distance) > storageError || fixedDot < .99999) throw new VillageAdmissibilityError(stop,
          'carry-fixed-guide-contact', 'unsupported-contact-geometry', Math.abs(fixedDistance - distance), storageError, 'Finite fixed guide does not oppose the jaw throughout its travel');
        ray.origin.subVectors(origin, parts.travel.clone().multiplyScalar(progress));
      }
    }
  }
  const tangentError = Math.max(Math.abs(parts.normal.dot(parts.tangent)), Math.abs(parts.across.dot(parts.tangent)), Math.abs(parts.normal.dot(parts.across)));
  if (tangentError > 64 * Number.EPSILON || parts.contactHalfLength <= 0 || parts.capacity <= 0) throw new VillageAdmissibilityError(stop,
    'carry-guide-frame', 'unsupported-contact-geometry', tangentError, 64 * Number.EPSILON);
}

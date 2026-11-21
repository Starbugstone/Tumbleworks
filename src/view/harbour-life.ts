import * as THREE from 'three';
import { appendWorldGeometry } from './world-bake';

/** Leave the sheltered inlet stern-first, turn outside the headland and come home.
 * The closing part of the curve is tangent to the first, so the bow stays put at anchor. */
const voyage = new THREE.CatmullRomCurve3([
  [-.5, 12.8], [-.45, 16.2], [1.1, 18.3], [5.3, 19.0], [8.6, 18.0],
  [8, 16.9], [4.6, 17.5], [.6, 17.1], [-.85, 15.1],
].map(([x,z]) => new THREE.Vector3(x, 0, z)), true);
const waterline = -.25;
const fishingGround = voyage.getPointAt(0).setY(waterline);

type Point = readonly [x: number, y: number, z: number];

/** Upper and lower surfaces meet at the outline and share the wing roots with the body. */
function gullMesh(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const white = new THREE.Color(0xf9f4e8);
  const silver = new THREE.Color(0xc0c8cc);
  const primary = new THREE.Color(0x323d48);
  const beak = new THREE.Color(0xb48a51);
  for (const side of [1, -1]) {
    for (const upper of [true, false]) {
      const mirrored = (side === 1) !== upper;
      const face = (a: Point, b: Point, c: Point, color: THREE.Color): void => {
        for (const [x, y, z] of mirrored ? [c, b, a] : [a, b, c]) {
          positions.push(side * x, y, z);
          colors.push(color.r, color.g, color.b);
        }
      };
      const quad = (a: Point, b: Point, c: Point, d: Point, color: THREE.Color): void => {
        face(a, b, c, color);
        face(a, c, d, color);
      };
      const bill: Point = [0, .005, .284];
      const billBase: Point = [.028, .002, .22];
      const billSpine: Point = [0, upper ? .029 : -.019, .229];
      const cheek: Point = [.057, .006, .164];
      const head: Point = [0, upper ? .072 : -.034, .17];
      const frontUnderside: Point = [.082, -.004, .079];
      const wingRootFront: Point = upper ? [.082, .024, .079] : frontUnderside;
      const shoulder: Point = [0, upper ? .085 : -.068, .075];
      const rearUnderside: Point = [.074, .001, -.127];
      const wingRootRear: Point = upper ? [.074, .024, -.127] : rearUnderside;
      const rump: Point = [0, upper ? .057 : -.048, -.117];
      const tailCorner: Point = [.069, .016, -.266];
      const tailMiddle: Point = [0, .016, -.257];
      face(bill, billBase, billSpine, beak);
      quad(billSpine, billBase, cheek, head, white);
      quad(head, cheek, wingRootFront, shoulder, white);
      quad(shoulder, wingRootFront, wingRootRear, rump, white);
      quad(rump, wingRootRear, tailCorner, tailMiddle, white);

      const wingShoulder: Point = [.203, .049, .121];
      const wristFront: Point = [.407, .049, .047];
      const wristRear: Point = [.381, .027, -.137];
      const wristRidge: Point = [.394, upper ? .065 : .022, -.045];
      const innerTrailing: Point = [.205, .018, -.151];
      const wingRidge: Point = [.222, upper ? .081 : .012, .007];
      const innerWing = [wingRootFront, wingShoulder, wristFront, wristRidge, wristRear, innerTrailing, wingRootRear];
      for (let i = 0; i < innerWing.length; i++) {
        face(wingRidge, innerWing[i]!, innerWing[(i + 1) % innerWing.length]!, silver);
      }
      const wingTip: Point = [.623, .052, -.101];
      const lastPrimary: Point = [.546, .039, -.17];
      const outerRidge: Point = [.515, upper ? .060 : .036, -.075];
      face(outerRidge, wristFront, wingTip, primary);
      face(outerRidge, wingTip, lastPrimary, primary);
      face(outerRidge, lastPrimary, wristRear, primary);
      face(outerRidge, wristRear, wristRidge, primary);
      face(outerRidge, wristRidge, wristFront, primary);

      if (upper) {
        face(wingRootFront, cheek, frontUnderside, white);
        face(wingShoulder, wingRootFront, frontUnderside, silver);
        face(wingRootRear, innerTrailing, rearUnderside, silver);
        face(tailCorner, wingRootRear, rearUnderside, white);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3(0, 0, 1);
const flights = [
  { start: 1.10, rate: .38, across: 1.55, along: 1.8, height: 2.62 },
  { start: 4.12, rate: .32, across: 1.3, along: 1.6, height: 3.14 },
];

/** Both gulls share the unshadowed launch draw while circling a fixed fishing ground. */
class FishingGulls {
  private readonly first: number;
  private readonly positions: THREE.BufferAttribute;
  private readonly normals: THREE.BufferAttribute;
  private readonly templatePositions: THREE.BufferAttribute;
  private readonly templateNormals: THREE.BufferAttribute;
  private readonly hullBounds: THREE.Sphere;
  private readonly bounds = new THREE.Sphere();
  private readonly birdBounds = new THREE.Sphere();
  private readonly inverseBoat = new THREE.Quaternion();
  private readonly orientation = new THREE.Quaternion();
  private readonly bank = new THREE.Quaternion();
  private readonly center = new THREE.Vector3();
  private readonly vertex = new THREE.Vector3();

  constructor(hull: THREE.Mesh<THREE.BufferGeometry>, private readonly boat: THREE.Group) {
    const geometry = hull.geometry;
    this.first = geometry.getAttribute('position').count;
    geometry.computeBoundingSphere();
    this.hullBounds = geometry.boundingSphere!.clone();
    const gull = gullMesh();
    gull.computeBoundingSphere();
    const templateBounds = gull.boundingSphere!;
    this.birdBounds.radius = templateBounds.radius + templateBounds.center.length();
    this.templatePositions = gull.getAttribute('position') as THREE.BufferAttribute;
    this.templateNormals = gull.getAttribute('normal') as THREE.BufferAttribute;
    appendWorldGeometry(hull, flights.map(() => gull));
    gull.dispose();
    this.positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    this.normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
    this.positions.setUsage(THREE.DynamicDrawUsage);
    this.normals.setUsage(THREE.DynamicDrawUsage);
    geometry.boundingSphere = this.bounds;
  }

  pose(seconds: number): void {
    this.inverseBoat.copy(this.boat.quaternion).invert();
    this.bounds.copy(this.hullBounds);
    const scale = this.boat.scale.x;
    let index = this.first;
    for (const { start, rate, across, along, height } of flights) {
      const phase = start + seconds * rate;
      const sin = Math.sin(phase), cos = Math.cos(phase);
      const heading = Math.atan2(across * cos, -along * sin);
      this.center.set(across * sin, height + .12 * Math.sin(phase * 2), along * cos)
        .multiplyScalar(scale).add(fishingGround).sub(this.boat.position).divideScalar(scale).applyQuaternion(this.inverseBoat);
      this.birdBounds.center.copy(this.center);
      this.bounds.union(this.birdBounds);
      this.bank.setFromAxisAngle(forward, -.14 + .05 * Math.cos(phase * 2));
      this.orientation.setFromAxisAngle(up, heading).multiply(this.bank).premultiply(this.inverseBoat);
      for (let i = 0; i < this.templatePositions.count; i++, index++) {
        this.vertex.fromBufferAttribute(this.templatePositions, i).applyQuaternion(this.orientation).add(this.center);
        this.positions.setXYZ(index, this.vertex.x, this.vertex.y, this.vertex.z);
        this.vertex.fromBufferAttribute(this.templateNormals, i).applyQuaternion(this.orientation);
        this.normals.setXYZ(index, this.vertex.x, this.vertex.y, this.vertex.z);
      }
    }
    for (const attribute of [this.positions, this.normals]) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(this.first * 3, (index - this.first) * 3);
      attribute.needsUpdate = true;
    }
  }
}

export class HarbourLaunch {
  private readonly point = new THREE.Vector3();
  private readonly heading = new THREE.Vector3();
  /** World XZ, heading and speed for the wake on the single water surface. */
  readonly wake = new THREE.Vector4();

  private readonly gulls?: FishingGulls;
  constructor(readonly boat: THREE.Group) {
    const hull = boat.children.find(child => child instanceof THREE.Mesh);
    if (hull instanceof THREE.Mesh) this.gulls = new FishingGulls(hull, boat);
    this.pose(0);
  }

  pose(seconds: number): void {
    const t = THREE.MathUtils.clamp((seconds % 49 - 3) / 32, 0, 1);
    const distance = t * t * (3 - 2 * t);
    voyage.getPointAt(distance, this.point);
    voyage.getTangentAt(distance, this.heading);
    const yaw = Math.atan2(this.heading.x, this.heading.z);
    this.boat.position.set(this.point.x, waterline + .025 * Math.sin(seconds * 1.8), this.point.z);
    this.boat.rotation.set(0.018 * Math.sin(seconds * 1.3), yaw + Math.PI / 2, 0.026 * Math.sin(seconds * 1.5));
    this.gulls?.pose(seconds);
    this.wake.set(this.point.x, this.point.z, yaw, 4 * t * (1 - t));
  }
}

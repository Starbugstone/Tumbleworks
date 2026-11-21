import * as THREE from 'three';
import { appendWorldGeometry } from './world-bake';

/** Leave the sheltered inlet stern-first, turn outside the headland and come home.
 * The closing part of the curve is tangent to the first, so the bow stays put at anchor. */
const voyage = new THREE.CatmullRomCurve3([
  [-.5, 12.8], [-.45, 16.2], [1.1, 18.3], [5.3, 19.0], [8.6, 18.0],
  [8, 16.9], [4.6, 17.5], [.6, 17.1], [-.85, 15.1],
].map(([x,z]) => new THREE.Vector3(x, 0, z)), true);

// A folded wing has an ivory inner fan and charcoal primary feathers, even in silhouette.
const wings: number[] = [];
const featherColours: number[] = [];
for (const side of [-1,1]) {
  const root=[0,0,.17], tail=[0,0,-.15], elbow=[side*.28,.09,.09], tip=[side*.54,.015,-.13];
  for (const [a,b,c,paint] of [[root,elbow,tail,0xf6f0d6],[tail,elbow,tip,0x546575]] as const) {
    const order=side>0 ? [a,b,c] : [c,b,a];
    const colour=new THREE.Color(paint);
    for (const point of order) { wings.push(...point); featherColours.push(colour.r,colour.g,colour.b); }
  }
}

/** The two gulls share the moving launch draw. Only their few vertices change when the village clock advances. */
class FishingGulls {
  private readonly first: number;
  private readonly positions: THREE.BufferAttribute;
  private readonly geometry: THREE.BufferGeometry;

  constructor(hull: THREE.Mesh) {
    this.geometry=hull.geometry;
    this.first=this.geometry.getAttribute('position').count;
    const birds=new THREE.BufferGeometry();
    birds.setAttribute('position',new THREE.Float32BufferAttribute([...wings,...wings],3));
    birds.setAttribute('color',new THREE.Float32BufferAttribute([...featherColours,...featherColours],3));
    birds.computeVertexNormals();
    appendWorldGeometry(hull,[birds]); birds.dispose();
    this.positions=this.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.positions.setUsage(THREE.DynamicDrawUsage);
    // The orbit remains inside this sphere as the launch changes course.
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,1.6,0),5);
  }
  pose(seconds:number):void {
    let index=this.first;
    for(let bird=0;bird<2;bird++) {
      const phase=seconds*(bird ? .33 : .42)+bird*3.1;
      const x=.2+1.7*Math.sin(phase), z=(bird ? 1.4 : 2.0)*Math.cos(phase);
      const height=2.5+bird*.58+.23*Math.sin(phase*1.7);
      const flap=.28*Math.sin(seconds*5.9+bird)*Math.max(0,Math.sin(phase*1.6));
      const ca=Math.cos(phase),sa=Math.sin(phase);
      for(let i=0;i<wings.length;i+=3){
        const span=wings[i]!, chord=wings[i+2]!;
        this.positions.setXYZ(index++,x+sa*span+ca*chord,height+wings[i+1]!+flap*Math.abs(span),z-ca*span+sa*chord);
      }
    }
    this.positions.clearUpdateRanges();
    this.positions.addUpdateRange(this.first*3,(index-this.first)*3);
    this.positions.needsUpdate=true;
  }
}

export class HarbourLaunch {
  private readonly point = new THREE.Vector3();
  private readonly heading = new THREE.Vector3();
  /** World XZ, heading and speed for the wake on the single water surface. */
  readonly wake = new THREE.Vector4();

  private readonly gulls?: FishingGulls;
  constructor(readonly boat: THREE.Group) {
    const hull=boat.children.find(child=>child instanceof THREE.Mesh);
    if (hull instanceof THREE.Mesh) this.gulls=new FishingGulls(hull);
    this.pose(0);
  }

  pose(seconds: number): void {
    const t = THREE.MathUtils.clamp((seconds % 49 - 3) / 32, 0, 1);
    const distance = t * t * (3 - 2 * t);
    voyage.getPointAt(distance, this.point);
    voyage.getTangentAt(distance, this.heading);
    const yaw = Math.atan2(this.heading.x, this.heading.z);
    this.boat.position.set(this.point.x, -.25 + .025 * Math.sin(seconds * 1.8), this.point.z);
    this.boat.rotation.set(0.018 * Math.sin(seconds * 1.3), yaw + Math.PI / 2, 0.026 * Math.sin(seconds * 1.5));
    this.gulls?.pose(seconds);
    this.wake.set(this.point.x, this.point.z, yaw, 4 * t * (1 - t));
  }
}

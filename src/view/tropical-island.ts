import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fuse, tinted } from './arcade';
import { distanceToPolygon, terrainHeightAt, terrainOccupancy, type VillageTerrain } from '../world/village-terrain';

type Edge = readonly [number, number, number, number, number, number];
/** Cell edges are shared with the authored terrain; only the unused sea-facing side gains a beach. */
export function coastalEdges(t: VillageTerrain): Edge[] {
  const edges: Edge[] = [], stride = t.columns + 1;
  const at = (c: number, r: number) => [t.originX + c * t.cellWidth, t.heights[r * stride + c]!, t.originZ + r * t.cellDepth] as const;
  for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.columns; c++) {
    if (t.cells[r * t.columns + c] !== 'land') continue;
    for (const [dc, dr, ac, ar, bc, br] of [[0,-1,c+1,r,c,r],[1,0,c+1,r+1,c+1,r],[0,1,c,r+1,c+1,r+1],[-1,0,c,r,c,r+1]]) {
      const nc = c + dc!, nr = r + dr!;
      if (nc >= 0 && nr >= 0 && nc < t.columns && nr < t.rows && t.cells[nr * t.columns + nc] !== 'void') continue;
      edges.push([...at(ac!, ar!), ...at(bc!, br!)]);
    }
  }
  return edges;
}
export function coastSample(edges: readonly Edge[], water: number, x: number, z: number): { distance: number; height: number } {
  let distance = Infinity, bank = water;
  for (const [ax, ay, az, bx, by, bz] of edges) {
    const dx = bx - ax, dz = bz - az;
    const u = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    const d = Math.hypot(x - ax - dx * u, z - az - dz * u);
    if (d < distance) { distance = d; bank = ay + (by - ay) * u; }
  }
  const width = 2.8 + .55 * Math.sin(x * .47 + z * .29) + .35 * Math.cos(z * .71 - x * .23);
  const fall = THREE.MathUtils.smoothstep(distance / width, 0, 1);
  return { distance, height: bank + (water - .35 - bank) * fall };
}

/** No beach is allowed inside an inlet or any protected swept structure bounds. */
export function tropicalCoast(t: VillageTerrain, protectedBounds: readonly THREE.Box3[]): THREE.BufferGeometry {
  const edges = coastalEdges(t), positions: number[] = [], colors: number[] = [];
  const color = new THREE.Color(), grass = new THREE.Color(0x60a95c), sand = new THREE.Color(0xf6dfac), wet = new THREE.Color(0xc6bd8a);
  const samples = new Map<string, ReturnType<typeof coastSample>>();
  const sampleAt=(x:number,z:number)=>{const key=`${x},${z}`;let sample=samples.get(key);if(!sample){sample=coastSample(edges,t.spec.water,x,z);samples.set(key,sample);}return sample;};
  const margin = 8, box = new THREE.Box3();
  type Patch={c:number;r:number;size:number};
  const cells=new Map<string,Patch>(),key=(c:number,r:number)=>`${c},${r}`;
  const point=(c:number,r:number)=>{const x=t.originX+c*t.cellWidth,z=t.originZ+r*t.cellDepth;return new THREE.Vector3(x,sampleAt(x,z).height,z);};
  for (let r = -margin; r < t.rows + margin; r++) for (let c = -margin; c < t.columns + margin; c++) {
    const x = t.originX + (c+.5) * t.cellWidth, z = t.originZ + (r+.5) * t.cellDepth;
    if (terrainOccupancy(t, x,z) !== 'void') continue;
    if (t.spec.features.some(f => f.kind === 'hole' && distanceToPolygon(f.polygon,x,z) < 1.1)) continue;
    if (sampleAt(x,z).distance > 3.5) continue;
    box.setFromPoints([point(c,r),point(c+1,r),point(c,r+1),point(c+1,r+1)]);
    if (protectedBounds.some(bound => bound.intersectsBox(box))) continue;
    cells.set(key(c,r),{c,r,size:1});
  }
  // Keep every original land-edge vertex. Coarsen only complete, empty outer squares;
  // fine neighbours retain their shared midpoint, so there are no open T-junctions.
  for(const size of [2,4])for(let r=-margin;r<t.rows+margin;r+=size)for(let c=-margin;c<t.columns+margin;c+=size){
    const square:Patch[]=[];let complete=true;
    for(let dz=0;dz<size;dz++)for(let dx=0;dx<size;dx++){const p=cells.get(key(c+dx,r+dz));if(p)square.push(p);else complete=false;}
    if(!complete)continue;
    const corners=[point(c,r),point(c+size,r),point(c,r+size),point(c+size,r+size)];
    if(corners.some(p=>sampleAt(p.x,p.z).distance<.8))continue;
    box.setFromPoints(corners);if(protectedBounds.some(bound=>bound.intersectsBox(box)))continue;
    const patch={c,r,size};for(let dz=0;dz<size;dz++)for(let dx=0;dx<size;dx++)cells.set(key(c+dx,r+dz),patch);
  }
  for(const patch of new Set(cells.values())){
    const {c,r,size}=patch,grid:[number,number][]=[];
    // Neighbour lookup uses exact integer cells on each side of a shared grid edge.
    grid.push([c,r]);for(let k=1;k<size;k++)if(cells.get(key(c-1,r+k-1))!==cells.get(key(c-1,r+k)))grid.push([c,r+k]);
    grid.push([c,r+size]);for(let k=1;k<size;k++)if(cells.get(key(c+k-1,r+size))!==cells.get(key(c+k,r+size)))grid.push([c+k,r+size]);
    grid.push([c+size,r+size]);for(let k=size-1;k>0;k--)if(cells.get(key(c+size,r+k-1))!==cells.get(key(c+size,r+k)))grid.push([c+size,r+k]);
    grid.push([c+size,r]);for(let k=size-1;k>0;k--)if(cells.get(key(c+k-1,r-1))!==cells.get(key(c+k,r-1)))grid.push([c+k,r]);
    const points=grid.map(([x,z])=>point(x,z));
    const faces=THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(p.x,p.z)),[]);
    for(const face of faces)for(const i of [...face].reverse()){
      const p=points[i]!;positions.push(p.x,p.y,p.z);
      const d=sampleAt(p.x,p.z).distance;
      color.copy(sand).lerp(grass,1-THREE.MathUtils.smoothstep(d,.05,1.4));
      color.lerp(wet,(1-THREE.MathUtils.smoothstep(p.y-t.spec.water,0,.35))*.4);
      colors.push(color.r,color.g,color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const smooth=mergeVertices(geometry);geometry.dispose();smooth.computeVertexNormals();smooth.computeBoundingBox();return smooth;
}

/** Curved trunks and folded, drooping fronds, fused into the existing static draw. */
export function islandPalms(t: VillageTerrain, beach: THREE.Mesh, protectedBounds: readonly THREE.Box3[], material: THREE.Material): THREE.Mesh | null {
  const parts: THREE.BufferGeometry[] = [], ray = new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  beach.updateMatrixWorld(true);
  const edges = coastalEdges(t), crown = new THREE.Vector3(), bounds = new THREE.Box3();
  let count = 0;
  for (let i = 0; i < edges.length && count < 9; i += 7) {
    const [ax,,az,bx,,bz] = edges[i]!, dx = bx-ax, dz=bz-az, length=Math.hypot(dx,dz);
    const x=(ax+bx)/2-dz/length*1.3,z=(az+bz)/2+dx/length*1.3;
    if (terrainHeightAt(t,x,z)!==undefined) continue;
    ray.ray.origin.set(x,50,z);const y=ray.intersectObject(beach)[0]?.point.y;
    if(y===undefined||y<t.spec.water+.5)continue;
    bounds.set(new THREE.Vector3(x-1.8,y-.05,z-1.8),new THREE.Vector3(x+1.8,y+4.8,z+1.8));
    if(protectedBounds.some(b=>b.intersectsBox(bounds)))continue;
    if(parts.length && count>0 && i%3===0)continue;
    const turn=i*2.399,height=2.7+(i%4)*.22;
    const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(x,y,z),new THREE.Vector3(x+.1,y+height*.6,z),new THREE.Vector3(x+.55*Math.cos(turn),y+height,z+.55*Math.sin(turn)));
    parts.push(tinted(new THREE.TubeGeometry(curve,2,.085,4,false),0x987446));
    crown.copy(curve.getPoint(1));
    for(let leaf=0;leaf<6;leaf++){
      const a=turn+leaf*Math.PI*2/6, pos:number[]=[];
      for(let s=0;s<2;s++)for(const [step,side] of (s===0?[[s,1],[s+1,1],[s+1,-1]]:[[s,-1],[s,1],[s+1,-1]])){
        const u=step!/2, reach=u*1.65, width=Math.sin(u*Math.PI)*.22*side!;
        pos.push(crown.x+Math.cos(a)*reach-Math.sin(a)*width,crown.y+.45*Math.sin(u*Math.PI)-u*u*.65-Math.abs(width)*.5,crown.z+Math.sin(a)*reach+Math.cos(a)*width);
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();parts.push(tinted(g,leaf%2?0x397e42:0x579c4c));
    }
    count++;
  }
  if(!parts.length)return null;
  const mesh=new THREE.Mesh(fuse(parts),material);mesh.name='village-palms';return mesh;
}

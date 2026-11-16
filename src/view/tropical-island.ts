import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fuse, tinted } from './arcade';
import { distanceToPolygon, pointInPolygon, terrainHeightAt, terrainOccupancy, type VillageTerrain } from '../world/village-terrain';
import { landFaceColour, sunny } from './village-terrain';

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
/** Land edges bucketed on a coarse ground grid; queries visit nearby edges in their original order. */
class EdgeIndex {
  private readonly buckets: number[][];
  private readonly x0: number; private readonly z0: number; private readonly nx: number; private readonly nz: number;
  private readonly seen: Uint32Array;
  private stamp = 0;
  readonly extent: number;
  constructor(edges: readonly Edge[], private readonly size = 1) {
    this.seen = new Uint32Array(edges.length);
    let loX = Infinity, hiX = -Infinity, loZ = Infinity, hiZ = -Infinity;
    for (const e of edges) { loX = Math.min(loX, e[0], e[3]); hiX = Math.max(hiX, e[0], e[3]); loZ = Math.min(loZ, e[2], e[5]); hiZ = Math.max(hiZ, e[2], e[5]); }
    if (!edges.length) loX = hiX = loZ = hiZ = 0;
    this.x0 = Math.floor(loX / size); this.z0 = Math.floor(loZ / size);
    this.nx = Math.floor(hiX / size) - this.x0 + 1; this.nz = Math.floor(hiZ / size) - this.z0 + 1;
    this.extent = Math.max(hiX - loX, hiZ - loZ);
    this.buckets = Array.from({ length: this.nx * this.nz }, () => []);
    edges.forEach((e, i) => {
      for (let bx = Math.floor(Math.min(e[0], e[3]) / size); bx <= Math.floor(Math.max(e[0], e[3]) / size); bx++)
        for (let bz = Math.floor(Math.min(e[2], e[5]) / size); bz <= Math.floor(Math.max(e[2], e[5]) / size); bz++) this.buckets[(bx - this.x0) * this.nz + bz - this.z0]!.push(i);
    });
  }
  /** Visit, once each, every edge that could lie within `radius` of the point. */
  near(x: number, z: number, radius: number, visit: (edge: number) => void): void {
    if (++this.stamp === 0xffffffff) { this.seen.fill(0); this.stamp = 1; }
    const s = this.size;
    const bx0 = Math.max(0, Math.floor((x - radius) / s) - this.x0), bx1 = Math.min(this.nx - 1, Math.floor((x + radius) / s) - this.x0);
    const bz0 = Math.max(0, Math.floor((z - radius) / s) - this.z0), bz1 = Math.min(this.nz - 1, Math.floor((z + radius) / s) - this.z0);
    for (let bx = bx0; bx <= bx1; bx++) for (let bz = bz0; bz <= bz1; bz++)
      for (const i of this.buckets[bx * this.nz + bz]!) if (this.seen[i] !== this.stamp) { this.seen[i] = this.stamp; visit(i); }
  }
}
const edgeIndexes = new WeakMap<readonly Edge[], EdgeIndex>();
const indexOf = (edges: readonly Edge[]) => { let index = edgeIndexes.get(edges); if (!index) edgeIndexes.set(edges, index = new EdgeIndex(edges)); return index; };
function edgeDistance(e: Edge, x: number, z: number): { d: number; u: number } {
  const [ax, , az, bx, , bz] = e, dx = bx - ax, dz = bz - az;
  const u = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return { d: Math.hypot(x - ax - dx * u, z - az - dz * u), u };
}
/** The nearest edge (first in order on a tie), its distance and the bank height along it there. */
function nearestEdge(edges: readonly Edge[], x: number, z: number): { distance: number; bank: number; edge: number } {
  const index = indexOf(edges);
  for (let radius = 1; ; radius *= 2) {
    let distance = Infinity, bank = 0, edge = -1;
    const consider = (i: number) => {
      const { d, u } = edgeDistance(edges[i]!, x, z);
      if (d < distance || d === distance && i < edge) { distance = d; bank = edges[i]![1] + (edges[i]![4] - edges[i]![1]) * u; edge = i; }
    };
    const all = radius > index.extent * 2;
    if (all) for (let i = 0; i < edges.length; i++) consider(i); else index.near(x, z, radius, consider);
    // An edge beyond the searched square is further than `radius`, so a nearer find inside it is final.
    if (all || distance <= radius) return { distance, bank, edge };
  }
}
/** The most any edge within `radius` of the point stands proud. */
function mostProud(edges: readonly Edge[], proud: Float64Array, x: number, z: number, radius: number): number {
  let most = 0;
  indexOf(edges).near(x, z, radius, i => { if (proud[i]! > most && edgeDistance(edges[i]!, x, z).d <= radius) most = proud[i]!; });
  return most;
}
interface Staircase { readonly proud: Float64Array; readonly step: number }
const staircases = new WeakMap<readonly Edge[], Staircase>();
/** Per cell edge, how far it stands outside the outline; and the longest step, which bounds a stair's reach. */
function staircase(edges: readonly Edge[], outside: (x: number, z: number) => number): Staircase {
  let stairs = staircases.get(edges);
  if (!stairs) {
    stairs = { proud: Float64Array.from(edges, e => Math.max(outside(e[0], e[2]), outside(e[3], e[5]))), step: Math.max(...edges.map(e => Math.hypot(e[3] - e[0], e[5] - e[2]))) };
    staircases.set(edges, stairs);
  }
  return stairs;
}
/**
 * `distance` is to the land's cell edges. `shore` measures from the authored outline instead: where a diagonal
 * outline leaves the land as a staircase of cells, the beach fills each step flush with the bank, so the
 * coast reads as the drawn line rather than the grid. It is 0 on every cell edge, so the bank stays sealed.
 */
export function coastSample(edges: readonly Edge[], water: number, x: number, z: number, outline?: readonly (readonly [number, number])[]): { distance: number; shore: number; height: number } {
  const { distance, bank } = nearestEdge(edges, x, z);
  let shore = distance;
  if (outline && edges.length) {
    const outside = (px: number, pz: number) => pointInPolygon(outline, px, pz) ? 0 : distanceToPolygon(outline, px, pz);
    // How far the nearby steps of the staircase stand proud of the outline; the beach is level with the bank
    // out to there. The steps within one diagonal of the longest step are the staircase around this point.
    const { proud, step } = staircase(edges, outside);
    shore = Math.min(distance, Math.max(0, outside(x, z) - mostProud(edges, proud, x, z, distance + Math.SQRT2 * step)));
  }
  const width = 2.8 + .55 * Math.sin(x * .47 + z * .29) + .35 * Math.cos(z * .71 - x * .23);
  const fall = THREE.MathUtils.smoothstep(shore / width, 0, 1);
  return { distance, shore, height: bank + (water - .35 - bank) * fall };
}

/**
 * Clearance boxes for every triangle of an object, in world space. A box around a whole merged machine
 * part spanned half a river and reached under the water, so the shore beside it vanished; per triangle,
 * the shore keeps clear of what is actually there.
 */
export function triangleBounds(object: THREE.Object3D, pad: THREE.Vector3, out: THREE.Box3[] = []): THREE.Box3[] {
  object.updateWorldMatrix(true, true);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  object.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = o.geometry.getAttribute('position') as THREE.BufferAttribute | undefined, ix = o.geometry.index;
    if (!p) return;
    const n = ix ? ix.count : p.count, at = (i: number) => ix ? ix.getX(i) : i;
    for (let i = 0; i + 2 < n; i += 3) {
      a.fromBufferAttribute(p, at(i)).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(p, at(i + 1)).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(p, at(i + 2)).applyMatrix4(o.matrixWorld);
      out.push(new THREE.Box3().setFromPoints([a, b, c]).expandByVector(pad));
    }
  });
  return out;
}
/** Boxes bucketed on a coarse ground grid, so a shore cell only meets the structures standing near it. */
class BoxIndex {
  private readonly buckets = new Map<string, number[]>();
  private readonly seen: Uint32Array;
  private stamp = 0;
  constructor(private readonly boxes: readonly THREE.Box3[], private readonly size = 1) {
    this.seen = new Uint32Array(boxes.length);
    boxes.forEach((box, i) => { for (const k of this.keys(box)) { let list = this.buckets.get(k); if (!list) this.buckets.set(k, list = []); list.push(i); } });
  }
  private *keys(box: THREE.Box3): Generator<string> {
    const s = this.size;
    for (let x = Math.floor(box.min.x / s); x <= Math.floor(box.max.x / s); x++) for (let z = Math.floor(box.min.z / s); z <= Math.floor(box.max.z / s); z++) yield `${x},${z}`;
  }
  hits(box: THREE.Box3): THREE.Box3[] {
    const out: THREE.Box3[] = [];
    if (++this.stamp === 0xffffffff) { this.seen.fill(0); this.stamp = 1; }
    for (const k of this.keys(box)) for (const i of this.buckets.get(k) ?? []) {
      if (this.seen[i] === this.stamp) continue;
      this.seen[i] = this.stamp;
      if (this.boxes[i]!.intersectsBox(box)) out.push(this.boxes[i]!);
    }
    return out;
  }
}

/** Steepest grade of a dip, rise per unit run: about the beach's own fall from a high bank. */
const DIP_SLOPE = 2;
/** `land` is the nearest land cell (row * columns + column) and `bank` that edge's height, where a dressing needs them. */
type ShoreSample = { distance: number; shore: number; height: number; land?: number; bank?: number };
/** One kind of shore dressing laid in the cells beside the land: the beach in the void, a bank in inlet water. */
interface Shore {
  /** The terrain cells it may occupy. */
  readonly host: 'void' | 'water';
  /** Whether a candidate cell at this centre gets dressing at all. */
  accepts(x: number, z: number, sample: ShoreSample): boolean;
  /** Cells that must stay open water: they lie on the sea floor and their neighbours slope down to them. */
  sinks?(x: number, z: number): boolean;
  /** Whether a far, even square may be drawn as one patch. */
  coarse?(sample: ShoreSample): boolean;
  sample(x: number, z: number): ShoreSample;
  /** Grade at which the dressing climbs back from where it must end under the water. */
  readonly endSlope?: number;
  /** Where to slide a free vertex, by at most `reach`, so it lies exactly on a contour the grid misses. */
  snap?(x: number, z: number, sample: ShoreSample, reach: number): readonly [number, number] | undefined;
  /** Dressing cells per land cell along each axis. */
  readonly subdivide?: number;
  /** Leave out cells lying wholly on the sea floor: the opaque sea already hides them. */
  readonly submergedDrop?: boolean;
  paint(point: THREE.Vector3, sample: ShoreSample, floor: number, out: THREE.Color): void;
}
/**
 * Shore dressing never cuts a hole: under a structure it dips just beneath it, and where a structure reaches
 * below the sea floor it sinks under the opaque sea, its neighbours sloping down to it so no ledge hangs
 * over the water. Every open edge either meets the land's own cliff or lies under the water.
 */
function shoreSurface(t: VillageTerrain, protectedBounds: readonly THREE.Box3[], shore: Shore): THREE.BufferGeometry {
  const positions: number[] = [], colors: number[] = [], color = new THREE.Color();
  const samples = new Map<string, ShoreSample>();
  const sampleAt=(x:number,z:number)=>{const key=`${x},${z}`;let sample=samples.get(key);if(!sample){sample=shore.sample(x,z);samples.set(key,sample);}return sample;};
  // The dressing may run on a finer grid than the land; every land vertex is still one of its vertices.
  const fine = shore.subdivide ?? 1, cw = t.cellWidth / fine, cd = t.cellDepth / fine, columns = t.columns * fine, rows = t.rows * fine;
  const margin = 8 * fine, box = new THREE.Box3(), floor = t.spec.water - .35, index = new BoxIndex(protectedBounds);
  type Patch={c:number;r:number;size:number};
  const cells=new Map<string,Patch>(),key=(c:number,r:number)=>`${c},${r}`;
  // Grid vertices with an explicit ceiling. Every other vertex keeps its natural height unless a cone of
  // DIP_SLOPE rising from a ceiling passes below it, so a dip has no step at its rim.
  const caps=new Map<string,{c:number;r:number;y:number;slope:number}>(),heights=new Map<string,number>();
  const cap=(c:number,r:number,y:number,slope=DIP_SLOPE)=>{const k=key(c,r),y0=Math.max(floor,y),prior=caps.get(k);if(prior&&prior.y<=y0&&prior.slope<=slope)return false;caps.set(k,{c,r,y:Math.min(y0,prior?.y??y0),slope:Math.min(slope,prior?.slope??slope)});heights.clear();return true;};
  const natural=(c:number,r:number)=>{const x=t.originX+c*cw,z=t.originZ+r*cd;return sampleAt(x,z).height;};
  const heightAt=(c:number,r:number)=>{
    const k=key(c,r);let y=heights.get(k);if(y!==undefined)return y;y=natural(c,r);
    for(const q of caps.values())y=Math.min(y,q.y+q.slope*Math.hypot((c-q.c)*cw,(r-q.r)*cd));
    heights.set(k,y);return y;
  };
  const point=(c:number,r:number)=>new THREE.Vector3(t.originX+c*cw,heightAt(c,r),t.originZ+r*cd);
  const corners=(c:number,r:number,size=1)=>[[c,r],[c+size,r],[c,r+size],[c+size,r+size]] as const;
  for (let r = -margin; r < rows + margin; r++) for (let c = -margin; c < columns + margin; c++) {
    const x = t.originX + (c+.5) * cw, z = t.originZ + (r+.5) * cd;
    if (terrainOccupancy(t, x,z) !== shore.host) continue;
    if (!shore.accepts(x, z, sampleAt(x,z))) continue;
    if (shore.sinks?.(x, z)) { for (const [vc,vr] of corners(c,r)) cap(vc,vr,floor); continue; }
    cells.set(key(c,r),{c,r,size:1});
  }
  // Only the land's cliff may close an edge; against other water or open sea the edge must be submerged.
  for(const {c,r} of [...cells.values()])for(const [dc,dr,a,b] of [[0,-1,[c,r],[c+1,r]],[1,0,[c+1,r],[c+1,r+1]],[0,1,[c,r+1],[c+1,r+1]],[-1,0,[c,r],[c,r+1]]] as const){
    if(cells.has(key(c+dc,r+dr))||terrainOccupancy(t,t.originX+(c+dc+.5)*cw,t.originZ+(r+dr+.5)*cd)==='land')continue;
    for(const [vc,vr] of [a,b])if(natural(vc,vr)>t.spec.water)cap(vc,vr,floor,shore.endSlope);
  }
  // Lowering only ever moves a vertex down, so this settles: each pass caps the corners of every cell that
  // still reaches a structure, just under that structure, until every remaining cell clears them all.
  for(let changed=true;changed;){
    changed=false;
    for(const [k,{c,r}] of cells){
      box.setFromPoints(corners(c,r).map(([vc,vr])=>point(vc,vr)));
      const hits=index.hits(box);if(!hits.length)continue;
      const ceiling=Math.min(...hits.map(bound=>bound.min.y))-.05;
      // A structure reaching below the sea floor keeps its footprint as open water.
      if(ceiling<=floor)cells.delete(k);
      for(const [vc,vr] of corners(c,r))changed=cap(vc,vr,ceiling)||changed;
    }
  }
  if(shore.submergedDrop)for(const [k,{c,r}] of cells)if(corners(c,r).every(([vc,vr])=>heightAt(vc,vr)<=floor+1e-6))cells.delete(k);
  const dipped=(c:number,r:number)=>heightAt(c,r)<natural(c,r);
  // Keep every original land-edge vertex. Coarsen only complete, empty outer squares;
  // fine neighbours retain their shared midpoint, so there are no open T-junctions.
  if(shore.coarse)for(const size of [2,4])for(let r=-margin;r<rows+margin;r+=size)for(let c=-margin;c<columns+margin;c+=size){
    const square:Patch[]=[];let complete=true;
    for(let dz=0;dz<size;dz++)for(let dx=0;dx<size;dx++){const p=cells.get(key(c+dx,r+dz));if(p)square.push(p);else complete=false;}
    if(!complete)continue;
    const outer=corners(c,r,size).map(([vc,vr])=>point(vc,vr));
    if(!outer.every(p=>shore.coarse!(sampleAt(p.x,p.z))))continue;
    // A coarse square drops its interior vertices, so it may not span any part of a dip.
    let even=true;for(let dz=0;dz<=size&&even;dz++)for(let dx=0;dx<=size&&even;dx++)if(dipped(c+dx,r+dz))even=false;
    if(!even)continue;
    box.setFromPoints(outer);if(index.hits(box).length)continue;
    const patch={c,r,size};for(let dz=0;dz<size;dz++)for(let dx=0;dx<size;dx++)cells.set(key(c+dx,r+dz),patch);
  }
  // A vertex inside the dressing, clear of the land, of any dip and of the dressing's edge, may slide onto a
  // contour (each vertex once, so neighbours share it); its height follows from where it lands.
  const placed=new Map<string,THREE.Vector3>();
  const place=(c:number,r:number)=>{
    const k=key(c,r);let p=placed.get(k);if(p)return p.clone();p=point(c,r);
    if(shore.snap&&!dipped(c,r)&&[[c-1,r-1],[c,r-1],[c-1,r],[c,r]].every(([a,b])=>cells.has(key(a!,b!)))){
      const sample=sampleAt(p.x,p.z),to=sample.distance>1e-6?shore.snap(p.x,p.z,sample,Math.min(cw,cd)/2):undefined;
      const y=to?sampleAt(to[0],to[1]).height:p.y;
      // Never slide up into a structure's clearance: the cells around the vertex were cleared at its old place.
      if(to&&!index.hits(box.set(new THREE.Vector3(Math.min(p.x,to[0])-cw,Math.min(p.y,y),Math.min(p.z,to[1])-cd),new THREE.Vector3(Math.max(p.x,to[0])+cw,Math.max(p.y,y),Math.max(p.z,to[1])+cd))).length)p.set(to[0],y,to[1]);
    }
    placed.set(k,p);return p.clone();
  };
  for(const patch of new Set(cells.values())){
    const {c,r,size}=patch,grid:[number,number][]=[];
    // Neighbour lookup uses exact integer cells on each side of a shared grid edge.
    grid.push([c,r]);for(let k=1;k<size;k++)if(cells.get(key(c-1,r+k-1))!==cells.get(key(c-1,r+k)))grid.push([c,r+k]);
    grid.push([c,r+size]);for(let k=1;k<size;k++)if(cells.get(key(c+k-1,r+size))!==cells.get(key(c+k,r+size)))grid.push([c+k,r+size]);
    grid.push([c+size,r+size]);for(let k=size-1;k>0;k--)if(cells.get(key(c+size,r+k-1))!==cells.get(key(c+size,r+k)))grid.push([c+size,r+k]);
    grid.push([c+size,r]);for(let k=size-1;k>0;k--)if(cells.get(key(c+k-1,r-1))!==cells.get(key(c+k,r-1)))grid.push([c+k,r]);
    const points=grid.map(([c,r])=>place(c,r));
    const faces=THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(p.x,p.z)),[]);
    for(const face of faces)for(const i of [...face].reverse()){
      const p=points[i]!;positions.push(p.x,p.y,p.z);
      shore.paint(p,sampleAt(p.x,p.z),floor,color);
      colors.push(color.r,color.g,color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const smooth=mergeVertices(geometry);geometry.dispose();smooth.computeVertexNormals();smooth.computeBoundingBox();return smooth;
}

/** No beach is allowed inside an inlet or any protected swept structure bounds. */
export function tropicalCoast(t: VillageTerrain, protectedBounds: readonly THREE.Box3[]): THREE.BufferGeometry {
  const edges = coastalEdges(t), grass = new THREE.Color(0x60a95c), sand = new THREE.Color(0xf6dfac), wet = new THREE.Color(0xc6bd8a);
  return shoreSurface(t, protectedBounds, {
    host: 'void',
    accepts: (_x, _z, sample) => sample.distance <= 3.5,
    // Inlet mouths stay open water.
    sinks: (x, z) => t.spec.features.some(f => f.kind === 'hole' && distanceToPolygon(f.polygon,x,z) < 1.1),
    coarse: sample => sample.distance >= .8,
    sample: (x, z) => coastSample(edges, t.spec.water, x, z, t.spec.outline),
    paint(p, sample, floor, color) {
      const d=sample.shore,y0=sample.height;
      // Grass belongs to the bank's top; the sides of a dip are sand, never green slabs over the water.
      const kept=y0>floor?THREE.MathUtils.smoothstep((p.y-floor)/(y0-floor),.55,.95):1;
      color.copy(sand).lerp(grass,(1-THREE.MathUtils.smoothstep(d,.05,1.4))*kept);
      color.lerp(wet,(1-THREE.MathUtils.smoothstep(p.y-t.spec.water,0,.35))*.4);
    },
  });
}

/** Grade of a river bank's face below its flush top, and the most river its foot may take. */
const BANK_SLOPE = 5, BANK_RUN = .45;
/** Banks higher than this above the water keep their plain cliff. */
export const BANK_HIGHEST = 1.2;
/** Land cell edges facing inlet or river water, with the land cell they belong to. */
function bankEdges(t: VillageTerrain): { edges: Edge[]; cells: number[] } {
  const edges: Edge[] = [], cells: number[] = [], stride = t.columns + 1;
  const at = (c: number, r: number) => [t.originX + c * t.cellWidth, t.heights[r * stride + c]!, t.originZ + r * t.cellDepth] as const;
  for (let r = 0; r < t.rows; r++) for (let c = 0; c < t.columns; c++) {
    if (t.cells[r * t.columns + c] !== 'land') continue;
    for (const [dc, dr, ac, ar, bc, br] of [[0,-1,c+1,r,c,r],[1,0,c+1,r+1,c+1,r],[0,1,c,r+1,c+1,r+1],[-1,0,c,r,c,r+1]]) {
      const nc = c + dc!, nr = r + dr!;
      if (nc < 0 || nr < 0 || nc >= t.columns || nr >= t.rows || t.cells[nr * t.columns + nc] !== 'water') continue;
      edges.push([...at(ac!, ar!), ...at(bc!, br!)]); cells.push(r * t.columns + c);
    }
  }
  return { edges, cells };
}
/**
 * Where a river or inlet is drawn at an angle across the grid, its banks are staircases of little cliffs.
 * A bank dressing in the water cells fills every step flush with the land, out to the staircase's outermost
 * corner, then falls steeply under the water, so the bank follows the drawn line and the river keeps its
 * width. Banks drawn along the grid keep their plain cliff. Land, physics and supports are untouched.
 */
export function riverBanks(t: VillageTerrain, protectedBounds: readonly THREE.Box3[]): THREE.BufferGeometry | null {
  const { edges, cells } = bankEdges(t), holes = t.spec.features.flatMap(f => f.kind === 'hole' ? [f.polygon] : []);
  if (!edges.length || !holes.length) return null;
  const floor = t.spec.water - .35, inWater = (x: number, z: number) => Math.max(0, ...holes.map(h => pointInPolygon(h, x, z) ? distanceToPolygon(h, x, z) : 0));
  const { proud, step } = staircase(edges, inWater);
  /** The drawn bank nearest a point runs at an angle across the grid. */
  const slanted = (x: number, z: number) => {
    let best = Infinity, slant = false;
    for (const h of holes) for (let i = 0; i < h.length; i++) {
      const a = h[i]!, b = h[(i + 1) % h.length]!, dx = b[0] - a[0], dz = b[1] - a[1];
      const u = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1), d = Math.hypot(x - a[0] - dx * u, z - a[1] - dz * u);
      if (d < best) { best = d; slant = Math.abs(dx) > 1e-6 && Math.abs(dz) > 1e-6; }
    }
    return slant;
  };
  // The face never takes more than BANK_RUN of the river: a high bank stands steeper rather than wider.
  const drop = (bank: number) => Math.min(BANK_RUN, 1.5 * Math.max(0, bank - floor) / BANK_SLOPE);
  const reach = Math.max(...edges.map((e, i) => proud[i]! + drop(Math.max(e[1], e[4])))) + Math.SQRT2 * step;
  const rock = sunny(t.spec.palette.rock, new THREE.Color()), top = new THREE.Color(), wet = new THREE.Color(0xe4dcb4);
  const geometry = shoreSurface(t, protectedBounds, {
    host: 'water',
    // A high cliff keeps its own wall: a near-vertical face over metres of rock shades as streaks.
    accepts: (x, z, sample) => sample.distance <= reach && (sample.bank ?? floor) - t.spec.water <= BANK_HIGHEST && slanted(x, z),
    sample(x, z) {
      const { distance, bank, edge } = nearestEdge(edges, x, z), land = cells[edge] ?? -1;
      const most = mostProud(edges, proud, x, z, distance + Math.SQRT2 * step);
      const shore = Math.min(distance, Math.max(0, inWater(x, z) - most)), width = drop(bank);
      const height = width > 0 ? bank + (floor - bank) * THREE.MathUtils.smoothstep(shore / width, 0, 1) : floor;
      return { distance, shore, height, land, bank };
    },
    // The bank's rim and its foot are contours the grid crosses at random; vertices near them slide onto them,
    // so both run as clean lines instead of a row of little teeth.
    snap(x, z, sample, reach) {
      const depth = inWater(x, z);
      if (depth <= 0 || sample.shore >= sample.distance) return undefined;
      const most = mostProud(edges, proud, x, z, sample.distance + Math.SQRT2 * step), f = depth - most;
      let best = Infinity, px = 0, pz = 0;
      for (const h of holes) for (let i = 0; i < h.length; i++) {
        const a = h[i]!, b = h[(i + 1) % h.length]!, dx = b[0] - a[0], dz = b[1] - a[1];
        const u = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1), qx = a[0] + dx * u, qz = a[1] + dz * u, d = Math.hypot(x - qx, z - qz);
        if (d < best) { best = d; px = qx; pz = qz; }
      }
      if (!(best > 1e-9)) return undefined;
      const moves = [0, drop(sample.bank ?? floor)].map(target => target - f).filter(move => Math.abs(move) < reach);
      if (!moves.length) return undefined;
      const move = moves.reduce((m, n) => Math.abs(n) < Math.abs(m) ? n : m);
      return [x + (x - px) / best * move, z + (z - pz) / best * move];
    },
    paint(p, sample, floor, color) {
      const bank = sample.bank ?? floor, land = sample.land ?? -1;
      if (land >= 0) landFaceColour(t, land % t.columns, Math.floor(land / t.columns), top); else top.copy(rock);
      // The flush top continues the land beside it; the steep face below is the cliff's own rock.
      const ratio = bank > floor ? (p.y - floor) / (bank - floor) : 0;
      color.copy(rock).lerp(top, THREE.MathUtils.smoothstep(ratio, .8, .97));
      // A pale wet line at the water's edge: rock, river and grass share a brightness, and the owner reads
      // the river's edge by this band, not by hue.
      const above = p.y - t.spec.water;
      color.lerp(wet, 1 - THREE.MathUtils.smoothstep(above, .08, .25));
    },
    // A bank ends at the river mouth as a cliff, like the land beside it, not as a ramp.
    endSlope: 8,
    subdivide: 2,
    submergedDrop: true,
  });
  if (!geometry.getAttribute('position').count) { geometry.dispose(); return null; }
  return geometry;
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

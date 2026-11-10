import{CAPTIVE_SLOT,captiveTop}from'./captive-slot-profile';
import { ExtrudeGeometry, Shape, Vector2, BufferGeometry, Float32BufferAttribute } from 'three';
/** Union of the two slot legs and their cap. Their shared faces are internal. */
export function slotLegGeometry(last: number, side: number): BufferGeometry {
  const outline = [[-.055, .055], [-.035, .055], [-.035, .645], [.035, .645],
    [.035, -.035], [.055, -.035], [.055, .665], [-.055, .665]];
  return new ExtrudeGeometry(new Shape(outline.map(([x, y]) => new Vector2(x!, y!))),
    { depth: .04, steps: 1, bevelEnabled: false }).translate(last, 0, side * .9 - .02);
}

/** Exact orthogonal post/brace union where the original packed post bottom is
 * flat. Sloping/nonplanar feet retain their original geometry.
 */
export function postBraceGeometry(x: number, endZ: number, footZ: number, width: number,
  roof: (x: number, z: number) => number, ground: (x: number, z: number) => number | undefined): BufferGeometry | undefined {
  const heights = [-1, 1].flatMap(a => [-1, 1].map(b => ground(x + a * width / 2, footZ + b * width / 2)));
  if (heights.some(h => h === undefined)) return;
  const height = Math.fround(heights[0]!);
  if (heights.some(h => Math.fround(h!) !== height)) return;
  const span = endZ - footZ;
  const shape = new Shape([[-width / 2, 0], [width / 2, 0], [width / 2, 1],
    [span + width / 2, 1], [span + width / 2, 2], [-width / 2, 2]].map(([z, layer]) => new Vector2(z!, layer!)));
  const geometry = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, steps: 1 });
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const z = footZ + p.getX(i), layer = p.getY(i), worldX = x + p.getZ(i) - width / 2;
    p.setXYZ(i, worldX, layer === 0 ? height : roof(worldX, z) - (layer === 1 ? .1 : 0), z);
  }
  const indices: number[] = [];
  for (let i = 0; i < p.count; i += 3) indices.push(i, i + 2, i + 1);
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Exact sheared L union, selected G-R58, no new triangles or mesh. */
export function captiveSlotCornerGeometry(first:number,last:number):BufferGeometry {
 if(!(last>first&&Number.isFinite(first)&&Number.isFinite(last)))throw new Error('Unsupported captive corner');
 const c=CAPTIVE_SLOT,F=first-.04,front=[[F,c.underFront],[last+.035,c.underFront],[last+.035,c.floor],[last+.045,c.floor],[last+.045,c.railTop],[F,c.railTop]],positions:number[]=[];
 const points=[c.front,c.back].flatMap(z=>front.map(([x,y],i)=>[x!,i===0||i===1?captiveTop(z):y!,z]));
 // Cap fans from the reflex vertex preserve the exact six-edge silhouette.
 const emit=(a:number,b:number,d:number)=>positions.push(...points[a]!,...points[b]!,...points[d]!);
 const area=front.reduce((s,p,i)=>{const q=front[(i+1)%6]!;return s+p[0]!*q[1]!-p[1]!*q[0]!;},0),ccw=area>0;
 for(const z of[0,1])for(const [a,b,d]of[[1,2,3],[1,3,4],[1,4,5],[1,5,0]]){if((z===0)===ccw)emit(a!+z*6,b!+z*6,d!+z*6);else emit(a!+z*6,d!+z*6,b!+z*6);}
 for(let i=0;i<6;i++){const j=(i+1)%6;if(ccw){emit(i,i+6,j);emit(j,i+6,j+6);}else{emit(i,j,i+6);emit(j,j+6,i+6);}}
 const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}

import { BufferAttribute, BufferGeometry } from 'three';
import type { VillageTerrain } from '../world/village-terrain';

export interface LandFace { readonly row:number; readonly column:number; readonly start:number }
export interface FlatLandRun {
  readonly row:number; readonly firstColumn:number; readonly lastColumn:number;
  readonly sourceStarts:readonly number[]; readonly sourceCorners:readonly number[];
  readonly outputStart:number;
}

/** Only the already packed, same-row rectangles supplied by the terrain builder
 * qualify. Numeric equality includes IEEE signed zero for upward normals;
 * no nonzero error or coordinate/attribute tolerance is admitted. Paint, nonland, differing attributes and grades retain their bytes. */
export function mergeFlatLand(geometry:BufferGeometry,terrain:VillageTerrain,faces:readonly LandFace[]):BufferGeometry {
  const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),color=geometry.getAttribute('color');
  if(geometry.index||!position||!normal||!color)throw new Error('Flat land needs the actual nonindexed position/normal/colour fields');
  const at=(i:number,k:number)=>position.getComponent(i,k);
  const eligible=(cell:LandFace)=>{
    const id=cell.row*terrain.columns+cell.column;
    if(terrain.cells[id]!=='land'||terrain.paint[id]!==0)return;
    const start = cell.start, y = position.getY(start);
    let loX = Infinity, hiX = -Infinity, loZ = Infinity, hiZ = -Infinity;
    for (let i = start; i < start + 6; i++) {
      if (!Object.is(position.getY(i), y) || normal.getY(i) !== 1 || normal.getX(i) !== 0 || normal.getZ(i) !== 0) return;
      if (color.getX(i) !== color.getX(start) || color.getY(i) !== color.getY(start) || color.getZ(i) !== color.getZ(start)) return;
      const x = position.getX(i), z = position.getZ(i);
      loX = Math.min(loX, x); hiX = Math.max(hiX, x);
      loZ = Math.min(loZ, z); hiZ = Math.max(hiZ, z);
    }
    if (!(loX < hiX && loZ < hiZ)) return;
    const corners: number[] = [], cornerIds: number[] = [];
    for (let i = start; i < start + 6; i++) {
      const x = position.getX(i), z = position.getZ(i);
      if ((x !== loX && x !== hiX) || (z !== loZ && z !== hiZ)) return;
      const corner = (x === hiX ? 1 : 0) + (z === hiZ ? 2 : 0);
      corners[corner] ??= i; cornerIds.push(corner);
    }
    if ([0, 1, 2, 3].some(corner => corners[corner] === undefined)) return;
    const area = (hiX - loX) * (hiZ - loZ);
    for (const a of [start, start + 3]) {
      const b = a + 1, c = a + 2;
      if ((at(b,0)-at(a,0))*(at(c,2)-at(a,2)) - (at(b,2)-at(a,2))*(at(c,0)-at(a,0)) !== -area) return;
    }
    // Two clockwise half rectangles tile their common extent only if their shared edge is a diagonal.
    const shared = cornerIds.slice(3).filter(corner => cornerIds.indexOf(corner) < 3);
    if (shared.length !== 2 || (shared[0]! ^ shared[1]!) !== 3) return;
    return{cell,corners,loX,hiX,loZ,hiZ,y};
  };
  const joins=(a:NonNullable<ReturnType<typeof eligible>>,b:NonNullable<ReturnType<typeof eligible>>)=>{
    if(a.cell.row!==b.cell.row||a.cell.column+1!==b.cell.column||a.hiX!==b.loX||a.loZ!==b.loZ||a.hiZ!==b.hiZ||!Object.is(a.y,b.y))return false;
    for(const attribute of[normal,color])for(let k=0;k<3;k++)if(attribute.getComponent(a.cell.start,k)!==attribute.getComponent(b.cell.start,k))return false;
    return true;
  };
  const replacements=new Map<number,number[]>(),removed=new Set<number>(),plans:{cells:LandFace[];corners:number[]}[]=[];
  for(let i=0;i<faces.length;){const first=eligible(faces[i++]!);if(!first)continue;let last=first;const cells=[first.cell];
    while(i<faces.length){const next=eligible(faces[i]!);if(!next||!joins(last,next))break;cells.push(next.cell);last=next;i++;}
    if(cells.length<2)continue;
    const [a,,c]=first.corners,[,b,,d]=last.corners;
    replacements.set(first.cell.start,[a!,d!,b!,a!,c!,d!]);for(const cell of cells.slice(1))removed.add(cell.start);
    plans.push({cells,corners:[a!,b!,c!,d!]});
  }
  if(!plans.length)return geometry;
  const remap = new Uint32Array(position.count - removed.size * 6);
  const outputStarts = new Map<number, number>();
  let output = 0;
  for (let i = 0; i < position.count;) {
    if (removed.has(i)) { i += 6; continue; }
    const replacement = replacements.get(i);
    if (replacement) {
      outputStarts.set(i, output);
      remap.set(replacement, output);
      output += replacement.length;
      i += 6;
    } else {
      remap[output++] = i++;
    }
  }
  const result = new BufferGeometry();
  for (const [name, attribute] of Object.entries({position, normal, color})) {
    const values = new Float32Array(output * 3);
    for (let i = 0; i < output; i++) {
      const source = remap[i]!;
      values[3*i] = attribute.getX(source);
      values[3*i+1] = attribute.getY(source);
      values[3*i+2] = attribute.getZ(source);
    }
    result.setAttribute(name, new BufferAttribute(values, 3));
  }
  result.boundingSphere=geometry.boundingSphere?.clone()??null;result.boundingBox=geometry.boundingBox?.clone()??null;
  result.userData={...geometry.userData,flatLandRuns:plans.map(({cells,corners}):FlatLandRun=>({row:cells[0]!.row,firstColumn:cells[0]!.column,lastColumn:cells.at(-1)!.column,sourceStarts:cells.map(c=>c.start),sourceCorners:corners,outputStart:outputStarts.get(cells[0]!.start)!}))};
  return result;
}

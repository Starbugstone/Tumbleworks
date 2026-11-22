import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Vector3 } from 'three';
import { pointInPolygon, terrainFieldHeight, type VillageTerrainSpec } from '../world/village-terrain';

/** An island on the chart follows the authored headlands, creeks and relief. Its narrow tidal apron meets the sea. */
export function miniatureLand(spec: VillageTerrainSpec): BufferGeometry {
  const rim = new CatmullRomCurve3(spec.outline.map(([x,z])=>new Vector3(x,0,z)),true,'centripetal');
  const coast = rim.getSpacedPoints(30).slice(0,-1);
  const turf = new Color(spec.palette.grass);
  const slate = new Color(spec.palette.cliff).lerp(new Color(0x636958),.22);
  const strand = new Color(spec.palette.shore);
  const surf = new Color(spec.palette.water).lerp(strand,.32);
  // On the chart the horizon extends past the footprint. Clip every skirt below its water level.
  const vertices:number[] = [], colours:number[] = [];
  const water = new Color(spec.palette.water), stone = new Color(spec.palette.rock);
  const paint = new Color();
  const top = (x:number,z:number) => {
    const hole=spec.features.some(f=>f.kind==='hole' && pointInPolygon(f.polygon,x,z));
    return hole ? spec.water : Math.max(spec.water, terrainFieldHeight(spec,x,z));
  };
  function face(a:Vector3,b:Vector3,c:Vector3,colour:Color) {
    vertices.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
    for (let i=0;i<3;i++) colours.push(colour.r,colour.g,colour.b);
  }
  const center = new Vector3(0,top(0,0),0);
  const rings = [.23,.48,.72,.88,1,1.04].map((fraction,band) => coast.map(({x,z})=>{
    x*=fraction; z*=fraction;
    const y = band===5 ? spec.water-.04 : band===4 ? spec.water+.16 : top(x,z);
    return new Vector3(x,y,z);
  }));
  for (let ring=0;ring<rings.length;ring++) {
    const outer=rings[ring]!, inner=rings[ring-1];
    for(let i=0;i<outer.length;i++) {
      const j=(i+1)%outer.length;
      const a=inner?.[i]??center,b=inner?.[j]??center,c=outer[i]!,d=outer[j]!;
      if(ring===5) paint.copy(surf);
      else if(ring===4) paint.copy(strand).lerp(slate,.22+(Math.sin(i*3.3)+1)*.09);
      else {
        const x=(a.x+b.x+c.x+d.x)*.25,z=(a.z+b.z+c.z+d.z)*.25;
        const grade=(Math.max(a.y,b.y,c.y,d.y)-Math.min(a.y,b.y,c.y,d.y))/Math.max(1,c.distanceTo(a));
        paint.copy(turf).lerp(stone,Math.min(.7,grade*.89));
        const feature=spec.features.find(f=>f.kind==='hole' && pointInPolygon(f.polygon,x,z));
        if(feature)paint.copy(water);
        else paint.multiplyScalar(.9+.12*Math.sin(x*.16+z*.5));
      }
      // The perimeter follows XZ clockwise when viewed from above.
      if(inner)face(a,b,d,paint);
      face(a,d,c,paint);
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colours,3));
  geometry.computeVertexNormals();
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
  const averaged = new Map<string,Vector3>();
  const corner = new Vector3(), faceNormal = new Vector3();
  for (let i = 0; i < position.count; i++) {
    const key = corner.fromBufferAttribute(position,i).toArray().join(',');
    const sum = averaged.get(key) ?? new Vector3();
    sum.add(faceNormal.fromBufferAttribute(normal,i));
    averaged.set(key,sum);
  }
  for (let i = 0; i < position.count; i++) {
    const key = corner.fromBufferAttribute(position,i).toArray().join(',');
    const n = averaged.get(key)!.normalize();
    normal.setXYZ(i,n.x,n.y,n.z);
  }
  geometry.userData.shore = rings[5];
  return geometry;
}

/** Nautical chart washes and soundings follow the projected shore of each island. Repaint only when the chart turns a page or changes size. */
export function paintIslandChart(canvas: HTMLCanvasElement, shores: readonly { x: number; y: number }[][]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width, height = canvas.height;
  const ocean = ctx.createLinearGradient(0, 0, width, height);
  ocean.addColorStop(0, '#224f60');
  ocean.addColorStop(.54, '#39717a');
  ocean.addColorStop(1, '#204958');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);
  for (const shore of shores) {
    const cx = shore.reduce((sum, p) => sum + p.x, 0) / shore.length;
    const cy = shore.reduce((sum, p) => sum + p.y, 0) / shore.length;
    for (const radius of [1.48, 1.29, 1.13, 1.035]) {
      ctx.beginPath();
      for (const [i, point] of shore.entries()) {
        const scale = radius + (radius - 1) * .12 * Math.sin(i * .6 + cy * .03);
        const x = cx + (point.x - cx) * scale, y = cy + (point.y - cy) * scale;
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(113,183,173,.085)';
      ctx.strokeStyle = 'rgba(182,211,188,.21)';
      ctx.lineWidth = .85;
      ctx.fill();
      ctx.stroke();
    }
  }
}

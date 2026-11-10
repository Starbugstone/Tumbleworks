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
    const ids=Array.from({length:6},(_,i)=>cell.start+i),y=at(cell.start,1);
    if(ids.some(i=>!Object.is(at(i,1),y)||normal.getY(i)!==1||normal.getX(i)!==0||normal.getZ(i)!==0))return;
    for(const attribute of[normal,color])for(const i of ids)for(let k=0;k<3;k++)if(attribute.getComponent(i,k)!==attribute.getComponent(cell.start,k))return;
    const loX=Math.min(...ids.map(i=>at(i,0))),hiX=Math.max(...ids.map(i=>at(i,0))),loZ=Math.min(...ids.map(i=>at(i,2))),hiZ=Math.max(...ids.map(i=>at(i,2)));
    if(!(loX<hiX&&loZ<hiZ))return;
    const corners=[[loX,loZ],[hiX,loZ],[loX,hiZ],[hiX,hiZ]].map(([x,z])=>ids.find(i=>at(i,0)===x&&at(i,2)===z));
    if(corners.some(i=>i===undefined)||ids.some(i=>![loX,hiX].includes(at(i,0))||![loZ,hiZ].includes(at(i,2))))return;
    const area=(hiX-loX)*(hiZ-loZ),edge=new Map<string,number>();
    for(let t=0;t<6;t+=3){const[a,b,c]=ids.slice(t,t+3);if((at(b!,0)-at(a!,0))*(at(c!,2)-at(a!,2))-(at(b!,2)-at(a!,2))*(at(c!,0)-at(a!,0))!==-area)return;
      for(let j=0;j<3;j++){const u=ids[t+j]!,v=ids[t+(j+1)%3]!,key=`${at(u,0)}/${at(u,2)}>${at(v,0)}/${at(v,2)}`;edge.set(key,(edge.get(key)??0)+1);}}
    const shared=[...edge.keys()].filter(k=>edge.has(k.split('>').reverse().join('>')));if(edge.size!==6||shared.length!==2)return;
    return{cell,corners:corners as number[],loX,hiX,loZ,hiZ,y};
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
  const values:Record<string,number[]>={position:[],normal:[],color:[]},outputStarts=new Map<number,number>();
  for(let i=0;i<position.count;){const replacement=replacements.get(i);if(removed.has(i)){i+=6;continue;}
    if(replacement){outputStarts.set(i,values.position!.length/3);for(const j of replacement)for(const[name,attribute]of Object.entries({position,normal,color}))for(let k=0;k<3;k++)values[name]!.push(attribute.getComponent(j,k));i+=6;}
    else{for(const[name,attribute]of Object.entries({position,normal,color}))for(let k=0;k<3;k++)values[name]!.push(attribute.getComponent(i,k));i++;}
  }
  const result=new BufferGeometry();for(const[name,array]of Object.entries(values))result.setAttribute(name,new BufferAttribute(new Float32Array(array),3));
  result.boundingSphere=geometry.boundingSphere?.clone()??null;result.boundingBox=geometry.boundingBox?.clone()??null;
  result.userData={...geometry.userData,flatLandRuns:plans.map(({cells,corners}):FlatLandRun=>({row:cells[0]!.row,firstColumn:cells[0]!.column,lastColumn:cells.at(-1)!.column,sourceStarts:cells.map(c=>c.start),sourceCorners:corners,outputStart:outputStarts.get(cells[0]!.start)!}))};
  return result;
}

import {Vector2} from 'three';
import {cellDiagonal,terrainVertex,type VillageTerrain} from '../../src/world/village-terrain';
import type {FootingPatch} from '../../src/world/pendulum-support';
/** Clip every actual terrain triangle to the full contact rectangle. A corner
 * height match does not establish interior coverage or rule out a void cell. */
export function actualFootPatch(terrain:VillageTerrain,p:FootingPatch){
 const minX=p.x-p.half,maxX=p.x+p.half,minZ=p.z-p.half,maxZ=p.z+p.half,polygons:{cell:number[];points:number[][];heightError:number;area:number}[]=[];
 const clip=(input:number[][],axis:0|2,cut:number,side:number)=>{
  const output:number[][]=[];if(!input.length)return output;let a=input.at(-1)!,da=side*(a[axis]!-cut);
  for(const b of input){const db=side*(b[axis]!-cut);if((da>=0)!==(db>=0)){const u=da/(da-db);output.push(a.map((x,i)=>x+u*(b[i]!-x)));}if(db>=0)output.push(b);a=b;da=db;}
  return output;
 };
 let area=0,maximumHeightError=0;
 for(let row=Math.max(0,Math.floor((minZ-terrain.originZ)/terrain.cellDepth));row<=Math.min(terrain.rows-1,Math.floor((maxZ-terrain.originZ)/terrain.cellDepth));row++)
 for(let col=Math.max(0,Math.floor((minX-terrain.originX)/terrain.cellWidth));col<=Math.min(terrain.columns-1,Math.floor((maxX-terrain.originX)/terrain.cellWidth));col++){
  if(terrain.cells[row*terrain.columns+col]!=='land')continue;
  const vertices=[terrainVertex(terrain,col,row),terrainVertex(terrain,col+1,row),terrainVertex(terrain,col,row+1),terrainVertex(terrain,col+1,row+1)];
  for(const indices of cellDiagonal(col,row)==='main'?[[0,1,3],[0,3,2]]:[[0,1,2],[1,3,2]]){
   let polygon=indices.map(i=>[...vertices[i]!]);for(const [axis,cut,side]of[[0,minX,1],[0,maxX,-1],[2,minZ,1],[2,maxZ,-1]]as const)polygon=clip(polygon,axis,cut,side);
   if(polygon.length<3)continue;
   let a=0;for(let i=1;i+1<polygon.length;i++){const x=polygon[0]!,y=polygon[i]!,z=polygon[i+1]!;a+=Math.abs(new Vector2(y[0]!-x[0]!,y[2]!-x[2]!).cross(new Vector2(z[0]!-x[0]!,z[2]!-x[2]!)))/2;}
   // K-S only certifies one planar contact patch. For a flat patch, vertices
   // suffice on every clipped actual terrain triangle, including its interior.
   const heightError=Math.max(...polygon.map(v=>Math.abs(v[1]!-p.heights[0])));
   area+=a;maximumHeightError=Math.max(maximumHeightError,heightError);polygons.push({cell:[col,row],points:polygon,heightError,area:a});
  }
 }
 return {area,expectedArea:4*p.half*p.half,maximumHeightError,polygons};
}

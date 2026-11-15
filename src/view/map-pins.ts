import type { ScreenPoint } from '../engine/contracts';

/** Badge artwork stays small; its 44px tap floor must not cover a neighbour's pin. */
export function separateMapPins(points: readonly ScreenPoint[], width:number,height:number): ScreenPoint[] {
  const placed:ScreenPoint[]=[];
  return points.map(point=>{
    if(point.x<22||point.x>width-22||point.y<125||point.y>height-145)return point;
    let best=point;
    const clear=(p:ScreenPoint)=>p.x>=22&&p.x<=width-22&&p.y>=125&&p.y<=height-145&&placed.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=45);
    if(!clear(best)){
      search:for(let radius=8;radius<=96;radius+=8)for(let angle=0;angle<16;angle++){
        const candidate={x:point.x+Math.cos(angle*Math.PI/8)*radius,y:point.y+Math.sin(angle*Math.PI/8)*radius};
        if(clear(candidate)){best=candidate;break search;}
      }
    }
    placed.push(best);return best;
  });
}

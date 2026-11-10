// Original gardens-final25 guard arithmetic and thresholds, unchanged.
type P={x:number;y:number};const distance=(p:P,a:P,b:P)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
const cross=(a:P,b:P,c:P)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const crossing=(a:P,b:P,c:P,d:P)=>cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
export function guards(p:readonly P[],g:readonly P[],w:P,door:P,width:number,height:number){const f:unknown[]=[];const badges=[...p,w],feet=[...g,door];
 for(const[i,q]of badges.entries())if(q.x-22<7||q.x+22>width-7||q.y-22<120||q.y+22>height-120)f.push({kind:'safearea',i,q});
 for(let a=0;a<10;a++)for(let b=a+1;b<10;b++){const d=Math.hypot(p[a]!.x-p[b]!.x,p[a]!.y-p[b]!.y);if(d<48)f.push({kind:'stop-distance',a,b,d});}
 for(let a=0;a<10;a++){const d=Math.hypot(p[a]!.x-w.x,p[a]!.y-w.y);if(d<52)f.push({kind:'workshop-distance',a,d});}
 for(let a=0;a<11;a++)for(let b=0;b<11;b++)if(a!==b){const d=distance(badges[b]!,badges[a]!,feet[a]!);if(d<30)f.push({kind:'foreign-badge-on-stem',stem:a,badge:b,d});}
 for(let a=0;a<11;a++)for(let b=a+1;b<11;b++)if(crossing(badges[a]!,feet[a]!,badges[b]!,feet[b]!))f.push({kind:'crossed-stems',a,b});return f;
}

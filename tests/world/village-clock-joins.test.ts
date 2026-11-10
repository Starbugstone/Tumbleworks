import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { VillageProgram } from '../../src/world/village-program';
import { CLOCKMAKERS_HILL } from '../../src/world/villages/clockmakers-hill';
it('carries positive matched speed through every ordinary full Clock join',()=>{
 const route=new VillageProgram(CLOCKMAKERS_HILL.plan),a=new Vector3(),b=new Vector3(),c=new Vector3(),h=1e-4;
 for(const segment of route.segments.slice(0,-1)){
  const time=segment.end;route.sample(time-h,a);route.sample(time,b);route.sample(time+h,c);
  const before=a.distanceTo(b)/h,after=b.distanceTo(c)/h;
  expect(before,`incoming ${segment.stop} ${segment.kind}`).toBeGreaterThan(.2);
  expect(after,`outgoing ${segment.stop} ${segment.kind}`).toBeGreaterThan(.2);
  expect(Math.abs(after-before)/Math.max(before,after),`matched ${segment.stop} ${segment.kind}`).toBeLessThan(.02);
 }
});

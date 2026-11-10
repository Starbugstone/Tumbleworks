// UNUSED / UNRUN. Structural supported-subset controls, not e0 no-Zeno claims.
import{expect,it}from'vitest';
import{orderedEvent,occupyCell,StrikeBudget}from'../../src/world/pendulum-episodes';
import{quinticValue}from'../../src/world/pendulum-free';
import type{EventBracket}from'../../src/world/pendulum-types';
it('shared knots are allowed, distinct overlapping event brackets and repeated starts in one cell reject',()=>{
 const first:EventBracket={id:'one',q:[.1,.11],time:[1,1.01]},same={...first},later:EventBracket={id:'two',q:[.2,.21],time:[2,2.01]};
 expect(()=>orderedEvent(7,first,same)).not.toThrow();expect(()=>orderedEvent(7,first,later)).not.toThrow();
 expect(()=>orderedEvent(7,first,{...later,q:[.105,.2]})).toThrow(/striker-contact-accumulation/);
 const used=new Set<number>();occupyCell(7,used,0);occupyCell(7,used,2);expect(()=>occupyCell(7,used,0)).toThrow(/striker-contact-accumulation/);
});
it('the fixed work budget is shared across episodes and event refinement',()=>{
 const b=new StrikeBudget(7,3);b.use(1,'contact');b.use(1,'free');b.use(1,'impact');expect(()=>b.use(1,'event-refinement')).toThrow(/striker-numerical-limit/);
});
it('quintic matches q/u/a at knots and exactly reproduces a quintic; a cubic mutant fails its C2 end condition',()=>{
 const q=(t:number)=>1+2*t+3*t*t+4*t**3+5*t**4+6*t**5,u=(t:number)=>2+6*t+12*t*t+20*t**3+30*t**4,a=(t:number)=>6+24*t+60*t*t+120*t**3;
 for(const t of[0,.1,.4,.8,1]){expect(quinticValue(q(0),q(1),u(0),u(1),a(0),a(1),0,1,t)).toBeCloseTo(q(t),12);expect(quinticValue(q(0),q(1),u(0),u(1),a(0),a(1),0,1,t,true)).toBeCloseTo(u(t),12);}
 const cubicA0=6*(q(1)-q(0))-4*u(0)-2*u(1);expect(Math.abs(cubicA0-a(0))).toBeGreaterThan(1);
});

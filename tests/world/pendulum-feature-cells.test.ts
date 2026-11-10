// UNUSED / UNRUN: actual packed construction, no village bank or Scene rebuild.
import{expect,it}from'vitest';
import{pendulumBar}from'../../src/view/pendulum-parts';
import{PendulumProfile}from'../../src/world/pendulum-profile';
import{featureCells,profileDerivativeRange}from'../../src/world/pendulum-cells';
import{PendulumCore}from'../../src/world/pendulum-core';
import{blankBarContact,type PendulumDrive,type PendulumRate}from'../../src/world/pendulum-types';
const d:PendulumDrive={kind:'pendulum',mass:.001,legacyGuideWork:{friction:.012,stroke:.5},axle:{origin:[0,1.6,0],axis:[0,0,1]},bar:{arm:1.6,radius:.04,length:.56,facets:16},footings:[],stopAngle:.7,dress:'mill-paddle'};
it('all active cells come from packed endpoint equations; repeated features have distinct interval IDs and two-sided C1 rates',()=>{
 const g=pendulumBar(d),p=new PendulumProfile(g,-.3,1.6),map=featureCells(7,p,.7),a=blankBarContact(),b=blankBarContact();
 try{
  expect(map.cells.length).toBeGreaterThan(1);expect(map.cells[0]!.q0).toBe(0);expect(map.clear).toBeDefined();
  for(const cell of map.cells){expect(cell.index).toBe(map.cells.indexOf(cell));expect(cell.q1).toBeGreaterThan(cell.q0);
   for(const u of[.1,.5,.9]){expect(p.sample(cell.q0+(cell.q1-cell.q0)*u,a)).toBe(true);expect(a.feature).toBe(cell.feature);}
  }
  for(let i=0;i+1<map.cells.length;i++){
   const left=map.cells[i]!,right=map.cells[i+1]!,q=left.q1;expect(q).toBe(right.q0);p.sampleFeature(left.feature,q,a,true);p.sampleFeature(right.feature,q,b,true);
   const coordinateRound=256*Number.EPSILON*Math.max(1,Math.abs(a.x),Math.abs(a.first),Math.abs(b.x),Math.abs(b.first),Math.abs(a.second),Math.abs(b.second))*Math.max(1,d.bar.arm)+(left.end[1]-left.end[0])*Math.max(Math.abs(a.second),Math.abs(b.second));
   expect(coordinateRound).toBeLessThan(1e-8);
   expect(Math.abs(a.x-b.x)).toBeLessThan(coordinateRound);expect(Math.abs(a.first-b.first)).toBeLessThan(coordinateRound);
   expect(Math.abs(a.second-b.second)).toBeGreaterThan(coordinateRound);
  }
  const separation=map.cells.find(c=>.37615507586750424>c.q0&&.37615507586750424<c.q1)!,witness=map.cells.find(c=>.4184108274757732>c.q0&&.4184108274757732<c.q1)!;
  expect(separation.kind).toBe('vertex');expect(witness.kind).toBe('edge');expect(witness.feature).toBe(map.cells[0]!.feature);expect(witness.index).not.toBe(map.cells[0]!.index);
 }finally{g.dispose();}
});
it('right-limit lambda is recomputed on its own feature instead of bisection through a curvature jump',()=>{
 const g=pendulumBar(d),p=new PendulumProfile(g,-.3,1.6),map=featureCells(7,p,.7),core=new PendulumCore(7,d,{mass:.001,axleInertia:.0014463873893668683,centre:[3.748204773557371e-18,-1.0381898377321408,-.22904205838774536],axialProducts:[0,0]},p),a=blankBarContact(),b=blankBarContact();
 const rate=():PendulumRate=>({q:0,u:0,w:0,angle:0,slipWork:0,contactWork:0,lambda:0,normal:0,friction:0,acceleration:0,slip:0});
 try{
  const cell=map.cells.find(c=>c.kind==='edge'&&c.q0>.37615507586750424)!,next=map.cells[cell.index+1]!;p.sampleFeature(cell.feature,cell.q1,a,true);p.sampleFeature(next.feature,cell.q1,b,true);
  const state={q:cell.q1,u:3.3,w:a.first*3.3,angle:0,slipWork:0,contactWork:0},left=rate(),right=rate();core.rateOnContact(state,{kind:'roll'},a,left);core.rateOnContact(state,{kind:'roll'},b,right);
  expect(left.lambda).toBeGreaterThan(0);expect(right.lambda).toBeLessThan(0);
  const interval=profileDerivativeRange(p,cell.feature,(cell.q0+cell.q1)/2,cell.q1,3);expect(interval[1]![0]).toBeGreaterThan(0);
 }finally{g.dispose();}
});

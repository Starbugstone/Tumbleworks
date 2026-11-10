import{it,expect}from'vitest';
import{assertHeadReleaseDrive}from'../../src/world/village-contact';
import{VillageProgram}from'../../src/world/village-program';
import{GLASSHOUSE_GARDENS}from'../../src/world/villages/glasshouse-gardens';
it('retains the G32 head-only lift counterexample while the repaired route compiles its planar terminal',()=>{
 const s=GLASSHOUSE_GARDENS.plan.stations.find(s=>s.stop===9)!,r=s.retention!;
 const lift=.6,T=r.gateSeconds,g=9.81*s.exit.normal[1];
 const allocated=r.gateMass*9.81*lift+.5*r.gateMass*(1.5*lift/T)**2;
 const required=r.headMass*(6*lift/T**2+g),available=allocated/lift;
 expect(required-available).toBeCloseTo(.012762828940301063,14);
 const route=new VillageProgram(GLASSHOUSE_GARDENS.plan);
 expect(route.admissibility).toBeUndefined();
 expect(()=>assertHeadReleaseDrive(9,r.headMass,6*lift/T**2,g,allocated,lift)).toThrow(/retained-release-drive drive-force/);
 expect(route.physicalLedger.some(entry=>entry.stop===0&&entry.phase==='terminal-capture')).toBe(true);
 expect(route.physicalLedger.some(entry=>entry.stop===9)).toBe(true);expect(route.physicalLedger.some(entry=>entry.stop===5)).toBe(true);expect(route.retainedHeadRole(5)).toBeDefined();expect(route.retainedHeadRole(1)).toBeDefined();expect(()=>route.requirePhysical()).not.toThrow();
});
it('necessary lift guard keeps signed gravity and zero-mass controls without declaring full feasibility',()=>{
 expect(()=>assertHeadReleaseDrive(1,0,10,9,0,.6)).not.toThrow();
 expect(()=>assertHeadReleaseDrive(1,.001,10,-9,.0006,.6)).not.toThrow();
 expect(()=>assertHeadReleaseDrive(1,.001,10,9,.0006,.6)).toThrow(/drive-force/);
});

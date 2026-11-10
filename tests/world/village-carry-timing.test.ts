import{it,expect}from'vitest';import{solveCarryTiming,carryReceipt,assertCarryGovernor}from'../../src/world/village-carry';
it('solves capacity-limited carry with reflected inertia and retains unenrolled-site rejection',()=>{
 const a=solveCarryTiming(5,.104,[.7,0,0],3,3.0536773884297517,.4,5);
 expect(a.binding).toBe('governor-capacity');expect(a.duration).toBeGreaterThan(1.98);expect(a.duration).toBeLessThan(2);expect(a.roundingSteps).toBeLessThanOrEqual(8);
 expect(a.receipt.governorForceRange[1]).toBeLessThanOrEqual(5);expect(a.receipt.minimumLineTension).toBeGreaterThan(0);
 const short=carryReceipt(.104,[.7,0,0],a.duration-2**-20,3.0536773884297517,.4);expect(short.governorForceRange[1]).toBeGreaterThan(5);
 expect(()=>assertCarryGovernor(5,a.receipt)).toThrow(/carry-governor/);
});
it('rejects insufficient source, capacity, static hold and invalid numeric inputs',()=>{
 expect(()=>solveCarryTiming(1,.104,[0,1.3,0],3,1,.4,5)).toThrow(/drive-force/);
 expect(()=>solveCarryTiming(5,.104,[.7,0,0],3,3,.4,1)).toThrow(/governor-capacity/);
 expect(()=>solveCarryTiming(1,1,[0,1,0],3,10,.4,2)).toThrow(/hold-bound/);
 expect(()=>solveCarryTiming(1,NaN,[0,1,0],3,10,.4,5)).toThrow();
});

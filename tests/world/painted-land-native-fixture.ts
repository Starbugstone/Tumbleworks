// Painted81 exact representation proof. Overrides ONE render flag during real WorldScene construction;
// preserves the current route/source75 data and never seeds a physical state.
import{vi}from'vitest';import*as plans from'../../src/world/village-plans';import{villageWorld}from'./village-world-fixture';
export function paintedWorld(chapter:number,enabled:boolean){const actual=plans.villageScenePlan,spy=vi.spyOn(plans,'villageScenePlan').mockImplementation(ch=>{const current=actual(ch);return ch===1?{...current,terrain:{...current.terrain,mergePaintedFlatLand:enabled}}:current;});try{return villageWorld(chapter);}finally{spy.mockRestore();}}

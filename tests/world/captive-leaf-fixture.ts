import{VillageProgram}from'../../src/world/village-program';
import{VillageRollingPrefix}from'../../src/world/village-prefix';
import{villageScenePlan}from'../../src/world/village-plans';
import type{VillagePlan,VillageStation}from'../../src/world/village-plan';
/** Actual CURRENT producer input, removing ONLY this prospective opt-in for a
 * real legacy counterfactual. No captured incoming speed, duration or force guessed. */
export function legacyGardenPlan():VillagePlan {
 const plan=villageScenePlan(1).plan;return{...plan,stations:plan.stations.map(station=>{
  if(station.retention?.opening!=='captive-leaf')return station;
  const{opening:_,...retention}=station.retention;return{...station,retention};
 })};
}
export function captiveStation(station:VillageStation):VillageStation {if(!station.retention)throw new Error('Actual captured retention required');return{...station,retention:{...station.retention,opening:'captive-leaf'}};}
export function legacyGarden(){const route=new VillageProgram(legacyGardenPlan());route.requirePhysical();const prefix:unknown=(route as unknown as{prefix?:unknown}).prefix;if(!(prefix instanceof VillageRollingPrefix))throw new Error('Actual cached prefix required');return{route,prefix};}

// Mill111 regression. Actual source plans only. No incoming speed setter or success receipt.
import{WILLOW_MILL}from'../../src/world/villages/willow-mill';
import{millAxleStation,millAxleSplice}from'../../src/world/mill-axle-first-consumer';
import{VillageRollingPrefix}from'../../src/world/village-prefix';
export function actualAxlePlan(){const original=WILLOW_MILL.plan,stations=original.stations.map(s=>s.stop===6?millAxleStation(s):s),at=(n:number)=>stations.find(s=>s.stop===n)!,connectors=original.connectors.map(c=>c.from===7||c.from===6?{...c,points:millAxleSplice(at(c.from).exit,at(c.to).entry),supports:[]}:c);return{...original,stations,connectors};}
export function actualConsumer(){return new VillageRollingPrefix(actualAxlePlan());}

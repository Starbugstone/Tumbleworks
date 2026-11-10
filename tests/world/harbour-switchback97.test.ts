import{expect,it}from'vitest';
import{villageScenePlan}from'../../src/world/village-plans';
import{compileTerrain}from'../../src/world/village-terrain';
import{actualFootPatch}from'./pendulum-feet';
import type{VillagePort}from'../../src/world/village-plan';
function levelHairpins(points:readonly VillagePort[]){
 expect(points).toHaveLength(91);
 for(const [first,last]of[[2,34],[42,74]])for(let i=first!;i<=last!;i++){expect(points[i]!.position[1]).toBe(points[first!]!.position[1]);expect(points[i]!.normal.every((v,k)=>v===[0,1,0][k])).toBe(true);expect(points[i]!.tangent[1]===0).toBe(true);}
 for(const [first,last]of[[0,2],[34,42],[74,90]])for(let i=first!;i<=last!;i++)expect(points[i]!.position[2]).toBe(points[first!]!.position[2]);
}
it('D96 keeps 32-step level unbanked hairpins and every height change on straight plan legs',()=>{
 const link=villageScenePlan(0).plan.connectors.find(l=>l.from===2)!;levelHairpins(link.points);
 const mutant=link.points.map((p,i)=>i===18?{...p,normal:[.01,Math.sqrt(1-.01**2),0]as const}:p);expect(()=>levelHairpins(mutant)).toThrow();
});
it('D96 has four piles with complete base footprints over flat actual mole land',()=>{
 const scene=villageScenePlan(0),link=scene.plan.connectors.find(l=>l.from===2)!,t=compileTerrain(scene.terrain);expect(link.supports).toHaveLength(4);
 for(const [x,,z]of link.supports!){const a=actualFootPatch(t,{x,z,half:.12,heights:[Math.fround(.4),Math.fround(.4),Math.fround(.4),Math.fround(.4)]});expect(a.maximumHeightError).toBe(0);expect(Math.abs(a.area-a.expectedArea)).toBeLessThan(128*Number.EPSILON);}
});

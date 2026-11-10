import{it,expect,beforeAll,afterAll}from'vitest';
import{Matrix4,Vector3}from'three';
import{axleCandidateFixture}from'./axle-candidate-fixture';
import{axleSpliceSource}from'../../src/view/axle-splice';
import{assertAxleDockCorrespondence}from'../../src/world/axle-dock-correspondence';
import{compareMC}from'../../src/world/axle-mc-comparison';
import{floorDistanceSquared,ordinaryUpper,type V}from'../../src/world/axle-floor-bound';
import{exact,rat,add,sub,mul,div,cmp}from'../../src/world/rocker-foot';
const Z=rat(0n),parse=(s:string)=>{const[n,d]=s.split('/');return rat(BigInt(n!),BigInt(d!));};
const step=(v:number,up:boolean)=>{const f=new Float32Array([v]),b=new Uint32Array(f.buffer);b[0]=v===0?(up?1:0x80000001):b[0]!+((v>0)===up?1:-1);return f[0]!;};
let x:ReturnType<typeof axleCandidateFixture>;beforeAll(()=>{x=axleCandidateFixture();},60000);afterAll(()=>x?.dispose());
it('positive MC uses a frozen witnessed LOWER, never a loose reference upper',()=>{
 const q=(n:number)=>rat(BigInt(n));
 expect(compareMC({candidateUpper:q(3),referenceWitnessSquared:q(4),referenceUpper:q(4)})).toBe('indeterminate'); // upper<=upper mutant falsely accepts
 expect(compareMC({candidateUpper:q(2),referenceWitnessSquared:q(4),referenceUpper:q(4)})).toBe('proved-by-enclosures');
 expect(compareMC({candidateUpper:q(5),candidateWitnessSquared:q(17),referenceWitnessSquared:q(4),referenceUpper:q(4)})).toBe('counterexample');
 for(const bad of[{candidateUpper:q(-1),referenceWitnessSquared:q(4),referenceUpper:q(4)},{candidateUpper:q(2),referenceWitnessSquared:q(17),referenceUpper:q(4)},{candidateUpper:q(2),candidateWitnessSquared:q(5),referenceWitnessSquared:q(4),referenceUpper:q(4)}])expect(()=>compareMC(bad)).toThrow();
 const near:V[]=[[0,0,0],[1,0,0],[0,1,0]],far:V[]=[[0,0,-3],[1,0,-3],[0,1,-3]];
 expect(floorDistanceSquared([.25,.25,1],[near,far],()=>{})).toEqual(rat(1n)); // one farther face is not the minimum
});
it('F141 chooses only the semantic TOP floor from the same nine, nonraising at BOTH normals, with independently ranked exact shifts',()=>{
 for(const dock of['home','top']as const){const link=x.machine.plan.connectors.find(c=>dock==='home'?c.to===6:c.from===6)!,g=x.machine.axleSpliceInspection(link).source.geometry,f=axleSpliceSource(g)!,M=f.facts.matrix.map(exact),det=sub(mul(M[0]!,M[5]!),mul(M[4]!,M[1]!)),m=parse(f.facts.nativeDeviation);
  for(const fact of f.facts.points){const[a,b]=fact.plain,candidates=[a,step(a,false),step(a,true)].flatMap(u=>[b,step(b,false),step(b,true)].map(v=>[u,v]as const)),signed=(p:readonly[number,number])=>sub(div(sub(mul(M[5]!,sub(exact(p[0]),M[12]!)),mul(M[4]!,sub(exact(p[1]),M[13]!))),det),exact(f.facts.deckEndLocalX)),floor=dock==='top'&&fact.plain[0]===f.facts.topFloor!.plain[0]&&fact.plain[1]===f.facts.topFloor!.plain[1],shift=(p:readonly[number,number],n:readonly number[])=>add(mul(sub(exact(p[0]),exact(a)),exact(n[0]!)),mul(sub(exact(p[1]),exact(b)),exact(n[1]!))),eligible=candidates.filter(p=>cmp(signed(p),rat(-m.n,m.d))<0&&(!floor||[link.points[0]!.normal,link.points[1]!.normal].every(n=>cmp(shift(p,n),Z)<=0)));
   eligible.sort((p,q)=>{if(floor){const n=link.points[0]!.normal,c=cmp(shift(p,n),shift(q,n));if(c)return c;const d=cmp(signed(q),signed(p));if(d)return d;}else{const d=Math.hypot(p[0]-a,p[1]-b)-Math.hypot(q[0]-a,q[1]-b);if(d)return d;}return p[0]-q[0]||p[1]-q[1];});expect(fact.stored).toEqual(eligible[0]);
  }
  if(dock==='home')expect(f.facts.topFloor).toBeUndefined();else{expect(f.facts.topFloor!.profile).toEqual([5,6]);expect(cmp(parse(f.facts.topFloor!.normalShift),Z)).toBeLessThanOrEqual(0);expect(cmp(parse(f.facts.topFloor!.nextNormalShift),Z)).toBeLessThanOrEqual(0);const p=g.getAttribute('position');for(let i=8;i<p.count-8;i++)for(let k=0;k<3;k++)expect(p.getComponent(i,k)).toBe(f.ordinary.positions[3*i+k]);}
 }
});
it('all FOUR finite half-cell enclosures pass the actual frozen nearest-material witnessed lower, without eligibility',()=>{
 const result=assertAxleDockCorrespondence({parts:x.binding.nativeParts(),land:x.land,sceneRoot:x.f.world.scene,canonical:x.binding.parts,model:x.motion,binding:x.binding,machine:x.machine});expect(result.docks.map(d=>d.dock)).toEqual(['home','top']);
 for(const d of result.docks){expect(d.decision).toBe('proved-by-enclosures');expect(d.fixed.domain).toEqual(d.dock==='home'?[.5,1]:[0,.5]);expect(d.deck.domain).toEqual(d.dock==='home'?[0,.5]:[.5,1]);expect(d.fixed.cells).toBe(256);expect(d.deck.cells).toBe(1);expect(d.candidateUpper**2).toBeLessThan(Number(parse(d.referenceWitness.squared).n)/Number(parse(d.referenceWitness.squared).d));}
 expect(x.motion.proof.state).toBe('pending');expect(x.machine.route.motionStatus.state).toBe('authoring');expect(x.motion.work.used).toBeLessThan(200000);
});
it('the actual old Euclid TOP store remains a permanent conditional MC counterexample at the unchanged causal time',()=>{
 const link=x.machine.plan.connectors.find(c=>c.from===6)!,source=x.machine.axleSpliceInspection(link),g=source.source.geometry.clone(),f=axleSpliceSource(source.source.geometry)!,p=g.getAttribute('position');
 try{const[a,b]=f.facts.topFloor!.plain,M0=f.facts.matrix.map(exact),det=sub(mul(M0[0]!,M0[5]!),mul(M0[4]!,M0[1]!)),m=parse(f.facts.nativeDeviation),signed=(u:number,v:number)=>sub(div(sub(mul(M0[5]!,sub(exact(u),M0[12]!)),mul(M0[4]!,sub(exact(v),M0[13]!))),det),exact(f.facts.deckEndLocalX)),choices=[a,step(a,false),step(a,true)].flatMap(u=>[b,step(b,false),step(b,true)].map(v=>[u,v]as const)).filter(([u,v])=>cmp(signed(u,v),rat(-m.n,m.d))<0);choices.sort((p,q)=>Math.hypot(p[0]-a,p[1]-b)-Math.hypot(q[0]-a,q[1]-b)||p[0]-q[0]||p[1]-q[1]);const old=choices[0]!;expect(old).not.toEqual(f.facts.topFloor!.stored); // independent old Euclid fixture, never a private production seal
  for(const i of[5,6])p.setXY(i,old[0],old[1]);
  const F=(i:number):V=>[f.ordinary.positions[3*(8*i+5)]!,f.ordinary.positions[3*(8*i+5)+1]!,-3],first=ordinaryUpper(link.points[0]!,link.points[1]!,F(0),F(1),.5,1,256,()=>{}),second=ordinaryUpper(link.points[1]!,link.points[2]!,F(1),F(2),0,.5,256,()=>{}),upper=cmp(first.upper,second.upper)>0?first.upper:second.upper;
  const time=12.383857466731065,point=new Vector3(),normal=new Vector3();x.machine.route.sample(time,point);x.machine.route.normalAt(time,normal);point.addScaledVector(normal,-.3);expect(point.toArray()).toEqual([-.17857133379394557,4.294243624987036,-3]);
  const triangles:V[][]=[],I=g.index!;for(let i=0;i<I.count;i+=3)if([0,1,2].every(j=>[5,6].includes(I.getX(i+j)%8)))triangles.push([0,1,2].map(j=>new Vector3().fromBufferAttribute(p,I.getX(i+j)).toArray()as V));
  const deck=x.binding.parts.find(p=>p.id==='deck-channel')!,dp=deck.render.getAttribute('position'),di=deck.render.index!,M=x.motion.carrierPose(time,new Matrix4());for(let i=0;i<di.count;i+=3)if([0,1,2].every(j=>[5,6].includes(di.getX(i+j)%8)))triangles.push([0,1,2].map(j=>new Vector3().fromBufferAttribute(dp,di.getX(i+j)).applyMatrix4(M).toArray()as V));
  const squared=floorDistanceSquared(point.toArray()as V,triangles,()=>{});expect(squared).toEqual(parse('364358749997733514580373935434281/2412841851714002059944535021795094290235392'));expect(cmp(squared,mul(upper,upper))).toBeGreaterThan(0);
 }finally{g.dispose();}
});

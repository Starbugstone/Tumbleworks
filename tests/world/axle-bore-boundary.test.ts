import{it,expect,beforeAll,afterAll}from'vitest';
import{oldAxleBoreFixture as axleCandidateFixture}from'./axle-old-bore-fixture';
import{assertAxleBoreBoundary}from'../../src/world/axle-bore-boundary';
import{rawTriangles}from'./axle-weld-oracle';
import{exactJointIntersection}from'./axle-exact-joint-oracle';
let x:ReturnType<typeof axleCandidateFixture>;beforeAll(()=>{x=axleCandidateFixture();},60000);afterAll(()=>x?.dispose());
const input=()=>({parts:x.binding.nativeParts(),land:x.land,sceneRoot:x.f.world.scene,canonical:x.binding.parts,model:x.motion,binding:x.binding,machine:x.machine});
it('actual closed spoke and boss retain a finite same-facing inner-air patch; rigid body membership grants no surface waiver',()=>{
 expect(()=>assertAxleBoreBoundary(input())).toThrow(/exposed-overlap/);expect(x.motion.proof.state).toBe('pending');
 x.machine.apply(x.motion.end);x.f.world.scene.updateMatrixWorld(true);
 try{const parts=x.binding.nativeParts(),a=parts.find(p=>p.id==='spoke-0')!,b=parts.find(p=>p.id==='pin-boss')!,A=rawTriangles(a.geometry,a.toWorld,a.first,a.count)[38]!,B=rawTriangles(b.geometry,b.toWorld,b.first,b.count)[54]!,patch=exactJointIntersection(A,B);expect(a.mesh).toBe(b.mesh);expect(patch.kind).toBe('coplanar');if(patch.kind!=='coplanar')throw Error('Missing exact bore patch');expect(patch.sameFacing).toBe(true);expect(patch.area).toBe('16589255719460985/41320737687356833792');expect(patch.value).toBeGreaterThan(0);}
 finally{x.machine.apply(0);x.f.world.scene.updateMatrixWorld(true);}
});
it('missing/wrong-body/foreign-frame native ranges cannot turn the named pair into authority',()=>{
 const base=input(),boss=base.parts.find(p=>p.id==='pin-boss')!;
 for(const parts of[base.parts.filter(p=>p!==boss),base.parts.map(p=>p===boss?{...p,body:'static'as const}:p),base.parts.map(p=>p===boss?{...p,toWorld:p.toWorld.clone().setPosition(1,2,3)}:p)])expect(()=>assertAxleBoreBoundary({...base,parts})).toThrow(/weld-identity/);
});
it('separated native faces remove THIS witness but never manufacture eligibility or a load certificate',()=>{
 const base=input(),boss=base.parts.find(p=>p.id==='pin-boss')!,p=boss.geometry.getAttribute('position'),old=Array.from({length:boss.count},(_,i)=>p.getZ(boss.first+i));
 try{for(let i=0;i<boss.count;i++)p.setZ(boss.first+i,old[i]!-.3);expect(assertAxleBoreBoundary(base).scope).toContain('not a global');expect(x.motion.proof.state).toBe('pending');}
 finally{for(let i=0;i<boss.count;i++)p.setZ(boss.first+i,old[i]!);}
 expect(()=>assertAxleBoreBoundary(input())).toThrow(/exposed-overlap/);
});

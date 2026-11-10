import { expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { StaticProofPlan, type SealedStaticProof } from '../../src/view/static-support-graph';
import { digestProofInput, type StaticProofInput, type StaticProofRequest } from '../../src/view/static-proof-protocol';
import { runStaticProofRequest } from '../../src/view/static-support-proof';
import { drain } from '../../src/view/cooperative';
import { villageWorld } from './village-world-fixture';
it('executes actual exact geometry/ground/material/graph rejections after a valid recomputed digest, then completes all334 original operations',()=>{
 let sealed:SealedStaticProof|undefined;const old=StaticProofPlan.prototype.seal,spy=vi.spyOn(StaticProofPlan.prototype,'seal').mockImplementation(function(this:StaticProofPlan,...args){return sealed=old.apply(this,args);});
 const f=villageWorld(0,false,'held');spy.mockRestore();try{const prepared=drain(sealed!.snapshot(()=>true)),request=structuredClone(prepared.request);const reject=(mutate:(input:StaticProofInput)=>void,pattern?:RegExp)=>{const next=structuredClone(request);mutate(next.input);const forged={...next,digest:digestProofInput(next.input)}as StaticProofRequest;const reply=runStaticProofRequest(forged);expect(reply.outcome).toBe('rejected');if(reply.outcome==='rejected'&&pattern)expect(reply.message).toMatch(pattern);};
 reject(input=>{for(let i=1;i<input.land.length;i+=3)input.land[i]=input.land[i]!+1;},/Ground facet penetration/);
 reject(input=>{(input as{expectedGround:readonly string[]}).expectedGround=input.expectedGround.slice(1);},/authorized33/);
 reject(input=>{(input as{requiredFloors:readonly string[]}).requiredFloors=[...input.requiredFloors,'missing-actual-floor'];},/Disconnected static floor/);
 reject(input=>{const body=input.bodies.find(b=>b.channel)!;(body.channel!.materialLoops as{start:readonly number[]}).start=[];});
 reject(input=>{input.bodies[0]!.positions[0]=Infinity;},/finite/i);
 const reply=runStaticProofRequest(structuredClone(request));expect(reply.outcome).toBe('certified');if(reply.outcome!=='certified')throw Error(reply.message);expect(reply.work).toMatchObject({bodies:131,ops:334,edges:1211,inputBytes:970176});const c=drain(prepared.accept(reply,()=>true));expect(createHash('sha256').update(JSON.stringify(c,(_,v)=>typeof v==='bigint'?String(v):v)).digest('hex')).toBe('7582aca0e39f0224393d5bea5b608aa804bcc59c244c7e23a5417db2735497dc');
 }finally{f.dispose();}
},120000);

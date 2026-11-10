import { it, expect, vi } from 'vitest';
import { StaticProofPlan, type SealedStaticProof } from '../../src/view/static-support-graph';
import { runStaticProofSteps } from '../../src/view/static-support-proof';
import { cooperate, drain } from '../../src/view/cooperative';
import { villageWorld } from './village-world-fixture';
import { ManualScheduler } from './manual-scheduler';
it('retains every ordered actual hash/op and cancels each worker phase kind without a partial reply',()=>{
 let sealed:SealedStaticProof|undefined;const original=StaticProofPlan.prototype.seal,spy=vi.spyOn(StaticProofPlan.prototype,'seal').mockImplementation(function(this:StaticProofPlan,...args){return sealed=original.apply(this,args);});const f=villageWorld(0,false,'held');spy.mockRestore();
 try{const p=drain(sealed!.snapshot(()=>true)),request=structuredClone(p.request),g=runStaticProofSteps(request),labels:string[]=[];let reply;for(;;){const next=g.next();if(next.done){reply=next.value;break;}labels.push(String(next.value));}expect(labels).toEqual([...request.input.bodies.map(b=>'hash:'+b.id),'hash:land',...request.input.ops.map((op,i)=>`op:${i}:${op.op}`)]);expect(reply.outcome).toBe('certified');if(reply.outcome!=='certified')throw Error(reply.message);expect(reply.work).toMatchObject({bodies:131,ops:334,edges:1211});
 const selected=new Set([0,request.input.bodies.length,labels.length-1]);for(const kind of['add','bond','roof','continuation','ground'])selected.add(labels.findIndex(x=>x.endsWith(':'+kind)));
 for(const index of selected)for(const failure of[false,true]){const inner=runStaticProofSteps(structuredClone(request));let calls=0;const wrapped=(function*(){try{for(;;){if(failure&&calls===index)throw Error('injected worker phase');calls++;const next=inner.next();if(next.done)return next.value;yield next.value;}}finally{inner.return(undefined as never);}})();const scheduler=new ManualScheduler(),settled=vi.fn(),run=cooperate(wrapped,scheduler,0,settled,'proof-worker');if(failure){scheduler.drain();expect(run.state).toBe('failed');expect(run.result).toBeUndefined();}else{for(let i=0;i<=index;i++)scheduler.step();run.cancel();const before=calls;scheduler.drain();expect(calls).toBe(before);expect(run.state).toBe('cancelled');expect(run.result).toBeUndefined();expect(settled).not.toHaveBeenCalled();}expect(scheduler.pending).toBe(0);}
 }finally{f.dispose();}
},120000);

import {expect,it,vi} from 'vitest';
import {cooperate,type TaskScheduler} from '../../src/view/cooperative';
import {ManualScheduler} from './manual-scheduler';

it('shipped-default and explicit diagnostic paths perform identical ordered work',()=>{
 const results=[];
 for(const diagnosticSteps of [false,true]){
  const clock=diagnosticSteps?new ManualScheduler(0,0,true):new ManualScheduler(),scheduler:TaskScheduler=clock,work:string[]=[];
  function* steps(){try{for(let i=0;i<5;i++){work.push('op'+i);yield 'op'+i;}return 17;}finally{work.push('cleanup');}}
  const spy=vi.spyOn(performance,'measure');
  try{const run=cooperate(steps(),scheduler,0,()=>{},'test');clock.drain();
   const measures=spy.mock.calls.filter(([name])=>name==='tumbleworks:step');
   expect(measures.length).toBe(diagnosticSteps?6:0);results.push({work,state:run.state,result:run.result});
  }finally{spy.mockRestore();}
 }
 expect(results[0]).toEqual(results[1]);expect(results[0]!.work).toHaveLength(6);
});

it('diagnostic opt-in does not change cancellation or failure cleanup',()=>{
 for(const diagnosticSteps of [false,true])for(const fail of [false,true]){
  const clock=new ManualScheduler(),scheduler:TaskScheduler={diagnosticSteps,post:task=>clock.post(task),now:()=>clock.now()};let cleanup=0,work=0;
  function* steps(){try{work++;yield 'first';work++;if(fail)throw Error('injected');return 3;}finally{cleanup++;}}
  const run=cooperate(steps(),scheduler,0,()=>{});clock.step();
  if(fail)clock.drain();else run.cancel();clock.drain();
  expect(run.state).toBe(fail?'failed':'cancelled');expect(work).toBe(fail?2:1);expect(cleanup).toBe(1);
 }
});

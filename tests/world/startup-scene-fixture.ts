// Explicit offline dependency injection: actual construction and exact kernel, no browser-worker claim.
import { WorldScene } from '../../src/view/world-scene';
import { WorldFilm } from '../../src/view/world-film';
import type { Stage } from '../../src/engine/stage';
import { InlineProofBackend } from './static-proof-inline';
import { ManualScheduler } from './manual-scheduler';
import { drain } from '../../src/view/cooperative';
import type { VillageMachine } from '../../src/view/village-machine';
export class TestWorldScene extends WorldScene {
 constructor(stage:Stage,chapter:number){const proof=new InlineProofBackend(),scheduler=new ManualScheduler();super(stage,chapter,{proof,scheduler,sliceMs:0});this.activateProof();scheduler.drain();proof.flush();scheduler.drain();}
}
export class TestWorldFilm extends WorldFilm {
 constructor(stage:Stage,chapter:number,current?:WorldScene){const proof=new InlineProofBackend(),scheduler=new ManualScheduler();super(stage,chapter,current,undefined,{proof,scheduler,sliceMs:0});scheduler.drain();proof.flush();scheduler.drain();if(this.readiness()==='ready'&&!this.begin())throw Error('Test film failed native start');}
}
export function enrolTestMachine(machine:VillageMachine):void{const proof=new InlineProofBackend(),scheduler=new ManualScheduler(),owner=drain(machine.sealStaticProof(proof,()=>true,scheduler,0));owner?.activate();scheduler.drain();proof.flush();scheduler.drain();}

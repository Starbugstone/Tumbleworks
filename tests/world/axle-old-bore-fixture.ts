import{vi}from'vitest';
import{BufferAttribute}from'three';
import*as builder from'../../src/view/axle-parts';
import{prism,prismLineage}from'../../src/view/axle-solid';
import{plainAxleJournalFixture}from'./axle-plain-journal-fixture';
/** Frozen original plain-journal producer with its original single bored spoke as an old-bug
 * mutant. No historical module execution, invented motion or positive issuer. */
export function oldAxleBoreFixture(){const original=builder.axleParts,spy=vi.spyOn(builder,'axleParts').mockImplementation((...args:Parameters<typeof original>)=>{const result=original(...args),boss=result.parts.find(p=>p.id==='pin-boss')!,spoke=result.parts.find(p=>p.id==='spoke-0')!,g=prism([[-.035,-2.07],[.035,-2.07],[.035,-.08],[-.035,-.08]],[prismLineage(boss.render).loops[1]!],-3.855,-3.805),rgb=spoke.render.getAttribute('color'),colors=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<colors.length;i++)colors[i]=rgb.array[i%3]!;g.setAttribute('color',new BufferAttribute(colors,3));spoke.render.dispose();return{...result,parts:result.parts.map(p=>p===spoke?{...p,render:g,solid:g}:p)};});try{return plainAxleJournalFixture();}finally{spy.mockRestore();}}

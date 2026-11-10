import{expect,it}from'vitest';
import{recontactFixture}from'./pendulum-recontact-fixture';
import{featureCells,trig,type Range}from'../../src/world/pendulum-cells';
import{blankBarContact,PROPOSED_NUMERICS,type StrikeError}from'../../src/world/pendulum-types';
import{featureBox,geometryBoxes,rootCoordinateError,contactVelocityError,freeMarbleBounds,coverApproach,coverClearance,clearanceLower,scale,impactInputError,rollingExitAngleBounds}from'../../src/world/pendulum-uncertainty';
import{modeAt,strikeEpisodes}from'../../src/world/pendulum-episodes';
import{sampleMarble,type MarbleSample}from'../../src/world/pendulum-free';
import{impactConeRoundoff}from'../../src/world/pendulum-impact';
const zero:StrikeError={q:0,time:0,x:0,v:0,u:0,w:0,angle:0,energy:0,lambda:0,normal:0,friction:0};
function contains(r:Range,v:number){expect(v).toBeGreaterThanOrEqual(r[0]);expect(v).toBeLessThanOrEqual(r[1]);}
it('encloses actual packed edge and vertex normals/J and derivatives over the entire q box, including near clear',()=>{
 const f=recontactFixture();try{const partition=featureCells(7,f.profile,.7),c=blankBarContact();for(const cell of partition.cells){const width=cell.q1-cell.q0,q=cell.kind==='vertex'?cell.q1-width/1000:(cell.q0+cell.q1)/2,dq=Math.min(1e-9,width/10000),g=featureBox(f.profile,cell.feature,q-dq,q+dq);for(let k=0;k<=100;k++){f.profile.sampleFeature(cell.feature,q-dq+2*dq*k/100,c,true);contains(g.nx,c.nx);contains(g.ny,c.ny);contains(g.H,-c.J);contains(g.first,c.first);contains(g.second,c.second);}}
 const cell=partition.cells[7]!,q=cell.q1-(cell.q1-cell.q0)/1000,dq=1e-9,a=blankBarContact(),b=blankBarContact();f.profile.sampleFeature(cell.feature,q,a,true);f.profile.sampleFeature(cell.feature,q+dq,b,true);expect(Math.abs(b.nx-a.nx)).toBeGreaterThan(100*dq*(Math.abs(a.ny)+1));
 const joint=partition.cells[1]!.q0;expect(new Set(geometryBoxes(7,f.profile,partition,joint,1e-10).map(g=>g.feature)).size).toBe(2);expect(()=>geometryBoxes(7,f.profile,partition,partition.clear![0],1e-9)).toThrow(/striker-uncertainty-domain/);
 }finally{f.dispose();}
});
it('uses angular root units independent of length units and impulse units independent of velocity units',()=>{
 const e=rootCoordinateError(1e-9,.9,2,.01);expect(e).toBeCloseTo(1.8e-7,20);expect(rootCoordinateError(1e-6,.9,2,10)).toBeCloseTo(e,20);expect(1e-9*.2*2/.01).toBeLessThan(e);expect(impactConeRoundoff(.02,.003,.01,.8)).toBe(128*Number.EPSILON*(.02+.003+.8*.01));expect(impactConeRoundoff(.2,.03,.1,.8)).toBeCloseTo(10*impactConeRoundoff(.02,.003,.01,.8),25);
});
it('rejects a post-impact near-zero load despite stale zero force errors, and an unresolved feature/clear domain',()=>{
 const f=recontactFixture();try{const q=.413,c=blankBarContact();f.profile.sample(q,c);const u=Math.sqrt(c.first*(f.core.potentialSlope(q)+f.core.torque)/(f.parts.axleInertia*c.second))*(1-1e-7),partition=featureCells(7,f.profile,.7),cell=partition.cells.find(c=>q>=c.q0&&q<c.q1)!,state={q,time:0,x:c.x,v:c.first*u,u,w:c.first*u,angle:0,floor:'roll' as const,error:{...zero,u:1e-3}};expect(()=>modeAt(f.core,state,cell,partition)).toThrow(/striker-contact-indeterminate/);expect(()=>impactInputError(f.core,{...state,q:partition.clear![0]-1e-10,error:{...zero,q:1e-9}},partition)).toThrow(/striker-uncertainty-domain/);
 const joint=partition.cells[1]!;f.profile.sampleFeature(joint.feature,joint.q0,c,true);const uc=Math.sqrt(c.first*(f.core.potentialSlope(joint.q0)+f.core.torque)/(f.parts.axleInertia*c.second));expect(()=>modeAt(f.core,{...state,q:joint.q0,v:c.first*uc,u:uc,w:c.first*uc,error:{...zero,u:1e-3}},joint,partition)).toThrow(/striker-contact-indeterminate/);
 }finally{f.dispose();}
});
it('propagates contact exit C-prime/u and C-double-prime/q uncertainty and slipping time through slip completion',()=>{
 const f=recontactFixture();try{const partition=featureCells(7,f.profile,.7),q=.413,u=2,dq=1e-8,du=1e-7,c=blankBarContact(),d=blankBarContact();f.profile.sample(q,c);const e=contactVelocityError(f.core,partition,q,u,dq,du);for(const sq of[-1,1])for(const su of[-1,1]){f.profile.sample(q+sq*dq,d);expect(Math.abs(d.first*(u+su*du)-c.first*u)).toBeLessThanOrEqual(e);}expect(e).toBeGreaterThan(Math.abs(c.first)*du);
 }finally{f.dispose();}
 const start={time:0,x:0,v:2,w:1,angle:.4,floor:'slip' as const},duration=1/(.8*9.81*3.5),target:MarbleSample={x:0,v:0,w:0,angle:0,loss:0,floor:'slip',friction:0};for(const time of[duration/2,duration,duration*2]){const e=1e-7,b=freeMarbleBounds(start,zero,time,e);for(let i=0;i<=20;i++){sampleMarble(start,time-e+2*e*i/20,target);for(const key of['x','v','w','angle']as const)contains(b[key],target[key]);}}
});
it('finds a hidden approach between all five old sample nodes; a grazing root is indeterminate rather than absent',()=>{
 const g=(q:number)=>.01+Math.cos(8*Math.PI*q),d=(a:number,b:number)=>scale(trig(8*Math.PI*a,8*Math.PI*b),-8*Math.PI),receipt={intervals:0,positive:0,monotone:0};let work=0;const use=()=>{if(++work>20000)throw new Error('work-limit');};expect([0,.25,.5,.75,1].every(q=>g(q)>0)).toBe(true);const root=coverApproach(7,0,1,g,d,use,receipt)!;expect(root[0]).toBeCloseTo(Math.acos(-.01)/(8*Math.PI),12);expect(receipt.intervals).toBeGreaterThan(1);
 expect(()=>coverApproach(7,0,1,q=>(q-.1)**2,(a,b)=>[2*(a-.1),2*(b-.1)],use,{intervals:0,positive:0,monotone:0})).toThrow(/indeterminate/);
});
it('uses whole-interval polygon distance/operator norm for post-bell clearance, and rejects an unsampled narrow dip',()=>{
 const f=recontactFixture();try{expect(clearanceLower(f.profile,[.7,.7],[.8,.81])).toBeGreaterThan(0);const q:Range=[.4,.401],x:Range=[-1.3,-1.29],lo=clearanceLower(f.profile,q,x);for(let i=0;i<=100;i++)expect(f.profile.clearance(q[0]+(q[1]-q[0])*i/100,x[0]+(x[1]-x[0])*i/100)).toBeGreaterThanOrEqual(lo);
 }finally{f.dispose();}
 let work=0;expect(()=>coverClearance(7,0,1,(a,b)=>a<=.123456&&b>=.123456?-1:1,()=>{if(++work>1000)throw new Error('work-limit');})).toThrow(/indeterminate/);
});
it('publishes actual nonzero left load/g2 and residual-derived launch timing without changing the first literal impulse',()=>{
 const f=recontactFixture();try{const s=strikeEpisodes(f.core,5.9718075582412755,5.9718075582412755,.8,PROPOSED_NUMERICS),first=s.episodes[0]!;expect(first.kind).toBe('impact');if(first.kind==='impact'){const literal=f.core.impact(5.9718075582412755,5.9718075582412755);expect(first.result.vAfter).toBe(literal.vAfter);}
 for(const e of s.episodes)if(e.kind==='free'){expect(e.motion.report.coverage!.intervals).toBeGreaterThan(0);expect(e.motion.report.launch!.lambdaLeft).toBeGreaterThanOrEqual(0);expect(e.motion.report.launch!.timeEstimate).toBeLessThan(PROPOSED_NUMERICS.eventTimeEstimate);expect(Number.isFinite(e.motion.report.launch!.secondDerivative)).toBe(true);}
 }finally{f.dispose();}
},120000);

it('conditions rolling exit angle on the finite deck event instead of spending independent time error twice',()=>{
 for(const floor of['roll','slip']as const){const start={time:0,x:0,v:2,w:floor==='roll'?2:1,angle:.4,floor},e={...zero,x:1e-8,v:1e-7,w:1e-7,angle:1e-9},end=1,b=rollingExitAngleBounds(start,e,end),target:MarbleSample={x:0,v:0,w:0,angle:0,loss:0,floor:'slip',friction:0};for(const sx of[-1,1])for(const sv of[-1,1])for(const sw of[-1,1]){const s={...start,x:sx*e.x,v:start.v+sv*e.v,w:floor==='roll'?start.v+sv*e.v:start.w+sw*e.w},duration=floor==='roll'?0:Math.abs(s.v-s.w)/(.8*9.81*3.5);sampleMarble(s,duration,target);const time=duration+(end-target.x)/target.v;sampleMarble(s,time,target);contains(b,target.angle);}}
});
it('refuses an actual packed-bar crossing even when both interval endpoints are clear',()=>{
 const f=recontactFixture();try{const c=blankBarContact();f.profile.sample(.55,c);const x=c.x+.02;expect(f.profile.clearance(0,x)).toBeGreaterThan(0);expect(f.profile.clearance(.7,x)).toBeGreaterThan(0);expect(f.profile.clearance(.55,x)).toBeLessThan(0);let work=0;expect(()=>coverClearance(7,0,.7,(a,b)=>clearanceLower(f.profile,[a,b],[x,x]),()=>{if(++work>1000)throw new Error('interval-work-cap');})).toThrow();}finally{f.dispose();}
});

import{Matrix4,Mesh}from'three';
import{axleHeadSourceContact}from'./axle-head-source-contact';
import{assertAxleHeadDomain}from'../view/axle-head-source';
import{reject,type NativeInput}from'./axle-types';
/** Real native component. This does not issue the seven-component certificate.
 * Source, slot/weld, numerical/event, foreign and ground authorities are distinct. */
export function axleHeadNative(input:NativeInput){
 const {model:m,binding:b}=input,s=m.station,tick=(n=1)=>m.work.tick(n);m.work.phase='native-head-source';
 if(input.canonical!==b.parts||b.motion!==m||input.machine.route.axleMotion(s.stop)!==m||!input.machine.root.getObjectById(b.carrier.id))reject(s,'weld-identity','Actual head owner/frame required');
 const source=axleHeadSourceContact(input.canonical,tick),domain=assertAxleHeadDomain(s.retention.captureStart,m.capturedX),stores=b.headStores;
 if(source.rho!==m.inventory.marble.radius||domain.rho!==stores.radius)reject(s,'head-contact','Marble/source radius ownership differs');
 m.work.phase='native-head-range';const q=b.journalCoordinate(),frame=m.kinematics.pose(q,new Matrix4());
 for(let p:import('three').Object3D|null=b.carrier;p;p=p.parent){tick();if(!p.visible||p.matrixWorldNeedsUpdate)reject(s,'weld-identity','Hidden/dirty actual head ancestor');if(p!==b.carrier&&!p.matrix.equals(new Matrix4()))reject(s,'weld-identity','Head requires actual identity ancestors');}
 b.carrier.updateWorldMatrix(true,false);if(frame.elements.some((v,i)=>v!==b.carrier.matrix.elements[i]||v!==b.carrier.matrixWorld.elements[i]))reject(s,'weld-identity','Actual carrier pose/operator differs');
 const live=b.nativeParts(),head=b.headCoordinate(),draw=stores.select(head);tick(b.ranges.length+8);for(const part of input.canonical.filter(p=>p.body==='capture-head')){const range=b.resolve(part.id).range,n=live.find(n=>n.id===part.id),p=part.render.getAttribute('position'),normal=part.render.getAttribute('normal'),index=part.render.index;if(!n||!(n.mesh instanceof Mesh)||n.mesh!==b.carrier||n.geometry!==b.carrier.geometry||n.first!==range.first||n.count!==range.count)reject(s,'weld-identity','Missing/foreign actual head range');const P=n.geometry.getAttribute('position'),N=n.geometry.getAttribute('normal');
  for(let i=0;i<range.count;i++){tick();const v=index?index.getX(i):i;if(range.sourceVertices[i]!==v)reject(s,'weld-identity','Changed head source expansion');for(let a=0;a<3;a++){tick();if(!Object.is(range.canonical[3*i+a],p.getComponent(v,a))||!Object.is(range.normals[3*i+a],normal.getComponent(v,a)))reject(s,'weld-identity','Changed head canonical range');if(!Object.is(P.getComponent(n.first+i,a),a===0?Math.fround(p.getX(v)+draw):p.getComponent(v,a))||!Object.is(N.getComponent(n.first+i,a),normal.getComponent(v,a)))reject(s,'weld-identity','Changed actual head store/normal');}}
 }
 return{state:'head-source-and-range-bound' as const,source,domain,observation:stores.observation,scope:'Exact physical common-frame source/contact cone and conditional binary64 correspondence; finite one-sided origin packing. Actual causal complementarity and complete scene/slot/wrench/ground/event/foreign authority remain separately mandatory.'};
}

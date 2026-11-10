import{spokeThroughBoss146}from'./axle-spoke';
// Mill111 selected axle implementation. Canonical per-part geometry, not a certificate. No generic legacy builder change.
import * as T from 'three';
import{axleHeadParts,sealAxleHeadColor}from'./axle-head-source';
import{VILLAGE_RADIUS}from'../world/village-plan';
import {villageChannelGeometry} from './machine-primitives';
import {villagePort,type VillagePort} from '../world/village-plan';
import {AxleKinematics} from '../world/axle-kinematics';
import type {AxleStation,Part,Body} from '../world/axle-types';
import {AxleLine} from './axle-line';
const paint=(g:T.BufferGeometry,color:number)=>{const rgb=new T.Color(color),a=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<a.length;i+=3){a[i]=rgb.r;a[i+1]=rgb.g;a[i+2]=rgb.b;}g.setAttribute('color',new T.BufferAttribute(a,3));return g;};
import {annulus,beam,box,closeChannel,polygon,prism,mitredGirder,caliperYoke,squareGuidePlanes,matchedSquareGuide,DirectedJournalConstruction156,sealDirectedJournalColor156} from './axle-solid';
import {axleHeadSlot}from'./axle-head-slot';
import type{AxleLand}from'./axle-ground';
import {buildCam,copyCam} from './axle-cam';
import{embeddedFloorCap,embeddedFloorCoreCap}from'./axle-floor-cap';
import{reject}from'../world/axle-types';
type SourceStamp156=readonly(number|string|boolean|null|undefined)[];
const coreSources156=new WeakMap<DirectedJournalConstruction156,{station:AxleStation;stamp:SourceStamp156;parts:readonly Part[];line:AxleLine;cam:ReturnType<typeof buildCam>}>();
function coreStamp156(value:unknown,tick:(n?:number)=>void):SourceStamp156{const out:(number|string|boolean|null|undefined)[]=[],active=new Set<object>();const take=(v:unknown)=>{tick();if(v===null||v===undefined||typeof v==='string'||typeof v==='boolean'||typeof v==='number'){if(typeof v==='number'&&!Number.isFinite(v))throw Error('Nonfinite core source');out.push(v as number|string|boolean|null|undefined);return;}if(typeof v!=='object'||Object.getPrototypeOf(v)!==(Array.isArray(v)?Array.prototype:Object.prototype))throw Error('Nonplain core source');tick();if(active.has(v))throw Error('Cyclic core source');active.add(v);out.push(Array.isArray(v)?'array':'object');for(const name of Object.keys(v)){tick();const descriptor=Object.getOwnPropertyDescriptor(v,name)!;if(!('value'in descriptor))throw Error('Accessor core source');out.push(name);take(descriptor.value);}tick();active.delete(v);out.push('end');};take(value);return Object.freeze(out);}

export function axleParts(s:AxleStation,land?:AxleLand,dockTracks?:readonly[readonly VillagePort[],readonly VillagePort[]],camTemplate?:ReturnType<typeof buildCam>,constructionTick:(n?:number)=>void=()=>{},journalConstruction?:DirectedJournalConstruction156){const k=new AxleKinematics(s),journals=journalConstruction??new DirectedJournalConstruction156(s,k,constructionTick),p=k.spec,existing=coreSources156.get(journals),parts:Part[]=existing?[...existing.parts]:[];if(existing){const stamp=coreStamp156(s,constructionTick);if(existing.station!==s||stamp.length!==existing.stamp.length||stamp.some((v,i)=>!Object.is(v,existing.stamp[i]))||camTemplate&&camTemplate!==existing.cam)reject(s,'weld-identity','Changed reused canonical axle core source');constructionTick(parts.length);}const add=(id:string,body:Body,frame:Part['frame'],render:T.BufferGeometry,nominal:Part['nominal']={})=>{paint(render,id==='deck-channel'?s.color:body==='weight'?0x596f70:body==='line'?0xb5925a:body==='static'?0x65543f:0x657578);sealDirectedJournalColor156(render,k,constructionTick);sealAxleHeadColor(render,constructionTick);parts.push({id,body,frame,render,solid:render,nominal});return render;};const fixed=(id:string,g:T.BufferGeometry)=>add(id,'static','world',g);const localZ=(z:number)=>z-s.anchor[2];
 const column=(id:string,x:number,z:number,w:number,d:number,top:number)=>{const g=box(x,0,z,w,1,d),v=g.getAttribute('position');g.computeBoundingBox();const b=g.boundingBox!,f=land!.foot(id,b.min.x,b.max.x,b.min.z,b.max.z),high=Math.fround(top);if(!(high>f.y))throw new Error('No finite standing axle column '+id);for(let i=0;i<v.count;i++)v.setY(i,v.getY(i)<0?f.y:high);g.computeVertexNormals();g.computeBoundingBox();return g;};
 try{let line:AxleLine,cam:ReturnType<typeof buildCam>;if(existing){line=existing.line;cam=existing.cam;}else{const deck=paint(villageChannelGeometry([villagePort([-.8,0,0]),villagePort([.8,0,0])],'timber'),s.color),closed=closeChannel(deck);parts.push({id:'deck-channel',body:'carrier',frame:'carrier-local',render:deck,solid:closed.geometry,closure:closed,nominal:{profile:'timber'}});
  add('back-bracket','carrier','carrier-local',box(-.3,-.185,-.53,.10,.49,.04));
  add('pin-shaft','carrier','carrier-local',journals.build(k,'J3-shaft',constructionTick),{radius:.025,facets:8});
  add('crank','carrier','carrier-local',beam(new T.Vector3(-.3,0,localZ(-3.95)),new T.Vector3(-.3+k.f[0],k.f[1],localZ(-3.95)),.06,.06));
  add('follower-pin','carrier','carrier-local',prism(polygon(p.follower.radius,8,-.3+k.f[0],k.f[1]),[],localZ(p.follower.z[0]),localZ(p.follower.z[1])),{radius:p.follower.radius,facets:8});
  const first=s.retention.captureStart+VILLAGE_RADIUS,last=first+s.retention.captureStroke;
  const head=axleHeadParts(constructionTick),slider=head.find(p=>p.id==='slider')!.geometry;slider.computeBoundingBox();const mountEnd=last+slider.boundingBox!.max.x+.01;
  for(const [id,c,size]of[['head-slot-leg',[mountEnd,-.16,.9],[.04,.30,.04]],['head-guide-bracket',[mountEnd,-.31,.70],[.04,.04,.36]],['head-guide-arm',[mountEnd,-.31,.17],[.04,.04,.70]]]as const)add(id,'carrier','carrier-local',box(c[0],c[1],c[2],size[0],size[1],size[2]));
  for(const part of head)add(part.id+'+','capture-head','head-local',part.geometry,{side:1});
  const slot=axleHeadSlot(parts.find(p=>p.id==='slider+')!.render,first,last);add('head-guide-lower','carrier','carrier-local',slot.lower);add('head-guide-upper','carrier','carrier-local',slot.upper);
  // Terminate the existing support leg INSIDE the actual upper rail's material,
  // rather than leaving its old top below the rail. All x/z/bottom loci stay.
  slot.upper.computeBoundingBox();const legIndex=parts.findIndex(p=>p.id==='head-slot-leg'),oldLeg=parts[legIndex]!,legBottom=-.31,legTop=(slot.faces.y[1]!+slot.upper.boundingBox!.max.y)/2,leg=paint(box(mountEnd,(legBottom+legTop)/2,.9,.04,legTop-legBottom,.04),0x657578);oldLeg.render.dispose();parts[legIndex]={...oldLeg,render:leg,solid:leg,nominal:{connection:'finite upper-rail material embed, same rigid carrier'}};
  add('live-axle','rotor','rotor-rest',journals.build(k,'J1-shaft',constructionTick),{radius:p.rotor.axle.radius,facets:8});
  add('hub','rotor','rotor-rest',prism(polygon(p.rotor.hub.radius,8),[],...p.rotor.hub.z));
  add('pin-boss','rotor','rotor-rest',journals.build(k,'J3',constructionTick));
  for(let i=0;i<3;i++){const a=-Math.PI/2+i*2*Math.PI/3,g=i===0?spokeThroughBoss146(parts.find(q=>q.id==='pin-boss')!.render,constructionTick):beam(new T.Vector3(.08*Math.cos(a),.08*Math.sin(a),-3.83),new T.Vector3(2.07*Math.cos(a),2.07*Math.sin(a),-3.83),.07,.05);add('spoke-'+i,'rotor','rotor-rest',g);}
  add('ring','rotor','rotor-rest',annulus(p.rotor.ring.inner,p.rotor.ring.outer,24,...p.rotor.plane));
  add('spool-drum','rotor','rotor-rest',prism(polygon(p.spool.pitch-p.line.halfWidth,12),[],...p.spool.drum),{pitch:p.spool.pitch,circumradius:p.spool.pitch-p.line.halfWidth});
  for(const [id,z0,z1]of[['spool-flange-front',-4.89,-4.87],['spool-flange-back',-5.03,-5.01]]as const)add(id,'rotor','rotor-rest',prism(polygon(p.spool.flange,12),[],z0,z1));
  const ca=-p.line.wrapMargin;add('drum-clamp','rotor','rotor-rest',box(p.spool.pitch*Math.cos(ca),p.spool.pitch*Math.sin(ca),-4.95,.05,.05,.06),{lineInterface:'finite embedded rope end'});
  const square=(cx:number,cy:number,h:number)=>[[cx-h,cy-h],[cx+h,cy-h],[cx+h,cy+h],[cx-h,cy+h]]as const;
  // Weight frame local y extrusion: two THROUGH bores, not boxes inserted as material.
  const wshape=prism(square(0,0,.19),[square(0,0,.0225),square(0,-.12,.0225)],-.35,.35).rotateX(Math.PI/2);add('axle-weight','weight','weight-rest',wshape);
  add('weight-clamp','weight','weight-rest',box(0,-.36,0,.08,.02,.08));
  line=new AxleLine(k,s.retention.weightDrop,parts.find(p=>p.id==='spool-drum')!.render);add('source-line','line','world',line.geometry,{model:line.semantic,segments:p.line.segments});
  cam=camTemplate?copyCam(k,camTemplate,constructionTick):buildCam(k);fixed('cam-plate',cam.geometry);
  const angle=p.caliper.angle,rs=p.caliper.patch,arc=(r:number)=>Array.from({length:3},(_,i)=>[k.O[0]+r*Math.cos(angle-rs.halfAngle+i*rs.halfAngle),k.O[1]+r*Math.sin(angle-rs.halfAngle+i*rs.halfAngle)]as const),patch=[...arc(rs.outer),...arc(rs.inner).reverse()];fixed('caliper-shoe-front',prism(patch,[],-3.80,-3.78));fixed('caliper-shoe-back',prism(patch,[],-3.88,-3.86));
  constructionTick(parts.length);coreSources156.set(journals,{station:s,stamp:coreStamp156(s,constructionTick),parts:Object.freeze(parts.slice()),line,cam});}

  if(!land)return{parts,line,cam,pending:['native-foot-land','finite-joint-welds','all-foreign-motion','range-stores-and-bounds']as const};
  for(const [suffix,z]of[['a',p.journals[0].z],['b',p.journals[1].z]]as const){const block=journals.build(k,suffix==='a'?'J1a':'J1b',constructionTick);block.computeBoundingBox();fixed('bearing-block-'+suffix,block);fixed('trestle-'+suffix,column('trestle-'+suffix,.3,z,.16,.10,block.boundingBox!.min.y));fixed('mast-'+suffix,box(.3,(k.O[1]+.08+3.83)/2,z,.1,3.83-k.O[1]-.08,.1));}
const angle=p.caliper.angle,cx=k.O[0]+2.23*Math.cos(angle),cy=k.O[1]+2.23*Math.sin(angle);fixed('caliper-post',column('caliper-post',cx,-3.83,.1,.1,cy));fixed('caliper-yoke',caliperYoke(k.O[0],k.O[1],angle));
  const gx=k.O[0]-p.spool.pitch,gz=-4.95,planes=squareGuidePlanes(parts.find(p=>p.id==='axle-weight')!.render,p.weight.guideOffsetZ),foot=land.foot('guide-rod',gx+planes.x0,gx+planes.x1,gz+planes.z0,gz+planes.z1);add('guide-rod','static','guide-local',matchedSquareGuide(planes,foot.y,Math.fround(2.95)),{frameX:gx,frameZ:gz,guide:'matched actual canonical square-bore planes'});
  // Fit the actual finite strut end to the back half of the cam's unused
  // axial slab. The follower back plane, not an invented weld tolerance, bounds it.
  cam.geometry.computeBoundingBox();const camBack=cam.geometry.boundingBox!.min.z,follower=parts.find(p=>p.id==='follower-pin')!.render;follower.computeBoundingBox();const followerBack=follower.boundingBox!.min.z+s.anchor[2],weldFront=Math.fround((camBack+followerBack)/2),restFollower=k.follower(0),wallMiddle=p.follower.radius+p.cam.wallBand/2,a=new T.Vector3(restFollower.F[0]+restFollower.nu[0]*wallMiddle,restFollower.F[1]+restFollower.nu[1]*wallMiddle,-4.11),b=new T.Vector3(.3,k.O[1]-.1,-4.35),low=beam(a,b,.06,.06),lp=low.getAttribute('position'),direction=a.clone().sub(b).normalize(),centre=a.clone().add(b).multiplyScalar(.5);low.computeBoundingBox();const endShift=weldFront-low.boundingBox!.max.z;for(let i=0;i<lp.count;i++)if(new T.Vector3().fromBufferAttribute(lp,i).sub(centre).dot(direction)>0)lp.setZ(i,lp.getZ(i)+endShift);low.computeVertexNormals();fixed('cam-strut-low',low);
  const girderBack=p.dock.path[3]![1],highBottom=Math.fround(p.dock.girderTop);fixed('cam-strut-high',box(.25,(5.08+highBottom)/2,(girderBack+camBack)/2,.10,5.08-highBottom,camBack-girderBack));
  fixed('dock-girder',mitredGirder(p.dock.path,.10,p.dock.girderTop-.10,p.dock.girderTop));
  if(dockTracks)for(let i=0;i<2;i++){const track=dockTracks[i]!,x=p.dock.caps[i]!.x;if(i===1){fixed('dock-cap-b',embeddedFloorCap(track,x,.13,p.dock.girderTop-.01).geometry);continue;}fixed('dock-cap-a',embeddedFloorCoreCap(track,x,.13,p.dock.girderTop-.01).geometry);}
  // Cap bottom is built down to a finite .01 girder embed, not an unsupported .12 default gap.
  return{parts,line,cam,pending:['native-foot-land','finite-joint-welds','all-foreign-motion','range-stores-and-bounds']as const};
 }catch(e){for(const part of parts){part.render.dispose();if(part.solid!==part.render)part.solid.dispose();}throw e;}}

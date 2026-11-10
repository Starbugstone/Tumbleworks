import type{AxleKinematics}from'./axle-kinematics';
import{rat,exact,add,sub,mul,div,cmp,type R}from'./rocker-foot';
import type{JournalPoint}from'../view/axle-journal-family';
const Z=rat(0n),ONE=rat(1n),TWO=rat(2n),abs=(v:R)=>rat(v.n<0n?-v.n:v.n,v.d),sum=(...v:R[])=>v.reduce(add,Z),gamma=(n:number)=>{const x=mul(rat(BigInt(n)),exact(Number.EPSILON/2));return div(x,sub(ONE,x));},maximumL1=(p:readonly JournalPoint[])=>p.reduce((s,p)=>{const a=add(abs(exact(p[0])),abs(exact(p[1])));return cmp(a,s)>0?a:s;},Z),text=(v:R)=>v.n+'/'+v.d;
/** Conditional eight-adjacent trig observation, not faithful-libm. L1 error
 * bounds dominate Euclidean errors. Actual identity parents and affine/Z paths
 * are mandatory native prerequisites, not a caller's asserted error value. */
export function journalOperatorBound(k:AxleKinematics,journal:'J1'|'J3',shaft:readonly JournalPoint[],bore:readonly JournalPoint[]){
 if(![...k.O,...k.pin,k.R,k.entry,k.delta,k.theta,k.spec.tilt.window].every(Number.isFinite)||!(k.R>0&&k.theta===Math.PI&&k.spec.tilt.window>0)||shaft.length===0||bore.length===0)throw Error('Invalid journal operator source/domain');
 const trig=mul(rat(8n),exact(Number.EPSILON)),trigScale=add(ONE,trig),S=maximumL1(shaft),B=maximumL1(bore),O=sum(abs(exact(k.O[0])),abs(exact(k.O[1]))),pin=sum(abs(exact(k.pin[0])),abs(exact(k.pin[1]))),R=exact(k.R),point=(magnitude:R,translation:R)=>mul(gamma(4),add(translation,mul(TWO,mul(trigScale,magnitude))));
 let EA:R,EB:R,centreDifference=Z,translation=Z;
 if(journal==='J1'){EA=sum(mul(TWO,mul(trig,S)),point(S,O));EB=Z;}else{
  // These are the actual two constant centre paths in axlePose/kinematics.
  const px=k.pin[0],py=k.pin[1],ox=k.station.anchor[0]+Math.cos(k.entry)*px-Math.sin(k.entry)*py,oy=k.station.anchor[1]+Math.sin(k.entry)*px+Math.cos(k.entry)*py+k.R;
  centreDifference=sum(abs(sub(exact(ox),exact(k.O[0]))),abs(sub(exact(oy),exact(k.O[1]))));
  const poseO=sum(abs(exact(ox)),abs(exact(oy))),translationMagnitude=sum(poseO,mul(TWO,mul(trigScale,R)),mul(TWO,mul(trigScale,pin)));
  translation=mul(gamma(6),translationMagnitude);
  const T=add(translationMagnitude,translation);
  EA=sum(centreDifference,mul(TWO,mul(trig,R)),mul(TWO,mul(trig,add(S,pin))),translation,point(S,T));
  // Bore rotates about O. Its absolute stored coordinates include the -R
  // centre: both orbit-centre and face perturbations are included here.
  EB=sum(mul(TWO,mul(trig,B)),point(B,O));
 }
 const total=add(EA,EB),nonOrthogonality=sum(mul(rat(4n),trig),mul(TWO,mul(trig,trig)));
 const result={journal,EA:Object.freeze(EA),EB:Object.freeze(EB),total:Object.freeze(total),rigorous:false as const,trace:Object.freeze({shaftCandidateL1:text(S),boreCandidateL1:text(B),orbitCentreL1:text(O),pinL1:text(pin),centreDifference:text(centreDifference),translationRoundoff:text(translation),trigAbsoluteObservation:text(trig),nonOrthogonalitySquared:text(nonOrthogonality),pointRoundingOperations:4,carrierTranslationRoundingOperations:journal==='J3'?6:0,parent:'Actual composed identity matrix at completed construction, verified per member/native range',z:'Literal affine third row [0,0,1,zOrigin], w=1; actual spans/end faces must be checked',derivation:'Compare actual c/s to ideal orthogonal rotation at the same actual angle under eight-adjacent observation. Two coordinate errors each <=trig*L1. gamma(4) bounds final two products/two additions. J3 additionally includes both constant centres, two orbit trig terms, uncancelled pin/point operands and gamma(6) translation path. Bore-side error separately reduces the actual convex-hull disk. J1 world-bore EB0 requires exact identity/store/native correspondence.'})};return Object.freeze(result);
}

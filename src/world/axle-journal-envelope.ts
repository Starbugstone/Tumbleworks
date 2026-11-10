import{rat,exact,add,sub,mul,div,cmp,type R}from'./rocker-foot';
import type{JournalPoint}from'../view/axle-journal-family';
const Z=rat(0n),sq=(x:R)=>mul(x,x),abs=(x:R)=>rat(x.n<0n?-x.n:x.n,x.d),P=(p:JournalPoint)=>p.map(exact)as[R,R],minus=(a:readonly R[],b:readonly R[])=>a.map((x,i)=>sub(x,b[i]!)),cross=(a:readonly R[],b:readonly R[])=>sub(mul(a[0]!,b[1]!),mul(a[1]!,b[0]!)),text=(x:R)=>x.n+'/'+x.d;
/** Pure conditional geometric lemma, not native authority. Native callers must
 * bind the real private source and derive EA/EB from BOTH actual operators. */
export function journalEnvelope(shaft:readonly JournalPoint[],bore:readonly JournalPoint[],shaftCentre:JournalPoint,boreCentre:JournalPoint,radius:number,EA:R,EB:R,tick:()=>void){
 if(shaft.length!==8||bore.length!==8||![...shaft.flat(),...bore.flat(),...shaftCentre,...boreCentre,radius].every(Number.isFinite)||!(radius>0)||EA.n<0n||EB.n<0n||EA.d<=0n||EB.d<=0n)throw Error('Invalid actual journal envelope domain');
 const S=P(shaftCentre),C=P(boreCentre),A=shaft.map(P),B=bore.map(P),r=exact(radius),total=add(EA,EB),remaining=sub(r,total);if(cmp(remaining,Z)<=0)throw Error('Journal operator observations consume radius');let max=Z;
 for(const p of A){tick();const d=minus(p,S),q=add(sq(d[0]!),sq(d[1]!));if(cmp(q,max)>0)max=q;}const radialSlack=sub(sq(remaining),max);if(cmp(radialSlack,Z)<=0)throw Error('Actual shaft radius is not strictly inside both-member error-reduced disk');
 const area=B.reduce((s,p,i)=>add(s,cross(p,B[(i+1)%8]!)),Z),orientation=cmp(area,Z);if(!orientation)throw Error('Zero actual bore orientation');let minimum:R|undefined,minimumConvex:R|undefined;const walls=[];
 for(let i=0;i<8;i++){const a=B[i]!,b=B[(i+1)%8]!,u=minus(b,a),v=minus(C,a),h=cross(u,v),length2=add(sq(u[0]!),sq(u[1]!));tick();if(cmp(h,Z)*orientation<=0||cmp(length2,Z)<=0)throw Error('Wrong actual bore centre/order');const supportSlack=sub(sq(h),mul(sq(r),length2));if(cmp(supportSlack,Z)<0)throw Error('Actual packed bore does not contain nominal disk');if(!minimum||cmp(supportSlack,minimum)<0)minimum=supportSlack;walls.push(Object.freeze({edge:i,squaredSupportSlack:text(div(supportSlack,length2))}));
  // Every nonincident vertex stays strictly on the inward side of every
  // actual edge. Compare an ideal rotation with arbitrary point errors EB.
  // |dU|infinity,|dV|infinity<=2EB; ideal edge L1<=2*source L1.
  // This encloses all angles and the entire straight homotopy of perturbations.
  for(let j=0;j<8;j++){if(j===i||j===(i+1)%8)continue;tick();const w=minus(B[j]!,a),turn=cross(u,w),L=u.concat(w).reduce((s,x)=>add(s,abs(x)),Z),error=add(mul(mul(rat(4n),EB),L),mul(rat(8n),sq(EB))),signed=orientation===1?turn:rat(-turn.n,turn.d),slack=sub(signed,error);if(cmp(slack,Z)<=0)throw Error('Rounded transformed bore convexity/order remains indeterminate');if(!minimumConvex||cmp(slack,minimumConvex)<0)minimumConvex=slack;}
 }
 return Object.freeze({rigorous:false as const,shaftMaximumRadiusSquared:text(max),bothMemberError:text(total),radialSquaredSlack:text(radialSlack),minimumSupportSquaredSlack:text(minimum!),transformedConvexitySlack:text(minimumConvex!),walls:Object.freeze(walls),domain:'All q in the actual closed [0,theta] domain under the stated binary64/eight-adjacent trig observation. Not a libm theorem.',proof:'The ideal convex bore contains disk(r). Every transformed bore vertex differs by <=EB, so its convex hull contains disk(r-EB), by support functions. Strict all-edge/vertex inequalities above preserve convexity/order for every perturbation and its homotopy. Every actual shaft vertex lies in disk(Rshaft+EA), strictly inside disk(r-EB). Convexity of source shaft/extrusion closes all facets, not only vertices. Finite axial/endcap/native ownership is a separate prerequisite.'});
}

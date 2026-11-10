import{axleHeadSourceContact}from'../../src/world/axle-head-source-contact';
import{it,expect}from'vitest';
import{Color,Float32BufferAttribute}from'three';
import{axleHeadParts,assertAxleHeadSource,sealAxleHeadColor,assertAxleHeadDomain,axleHeadOrigin}from'../../src/view/axle-head-source';
import{keyedHeadParts}from'../../src/view/retainer-parts';
import{floorDistanceSquared}from'../../src/world/axle-floor-bound';
import{exact,mul,cmp,sub,add,rat}from'../../src/world/rocker-foot';
import{VILLAGE_RADIUS}from'../../src/world/village-plan';
const paint=(g:ReturnType<typeof axleHeadParts>[number]['geometry'])=>{const c=new Color(0x657578),a=Array.from({length:g.getAttribute('position').count},()=>[c.r,c.g,c.b]).flat();g.setAttribute('color',new Float32BufferAttribute(a,3));};
it('actual complete head surfaces contact at an exact finite edge without source penetration',()=>{let used=0;const ps=axleHeadParts(n=>used+=n??1),old=keyedHeadParts('timber',1);try{const all: [number,number,number][][]=[];for(const p of ps){paint(p.geometry);sealAxleHeadColor(p.geometry,()=>{});assertAxleHeadSource(p.geometry,()=>{});const P=p.geometry.getAttribute('position'),I=p.geometry.index;for(let i=0;i<P.count;i++)expect(P.getX(i)).toBeGreaterThanOrEqual(0);for(let i=0;i<(I?.count??P.count);i+=3)all.push([0,1,2].map(j=>{const v=I?I.getX(i+j):i+j;return[P.getX(v),P.getY(v),P.getZ(v)]as[number,number,number];}));expect(I?.count??P.count).toBe(old.find(o=>o.id===p.id)!.geometry.index?.count??old.find(o=>o.id===p.id)!.geometry.getAttribute('position').count);}
 const component=axleHeadSourceContact(ps.map(p=>({id:p.id+'+',body:'capture-head' as const,frame:'head-local' as const,render:p.geometry,solid:p.geometry,nominal:{}})),()=>{});expect(component.closed).toHaveLength(4);
 const d=floorDistanceSquared([-VILLAGE_RADIUS,0,0],all,()=>{});expect(cmp(d,mul(exact(VILLAGE_RADIUS),exact(VILLAGE_RADIUS)))).toBe(0);expect(used).toBeGreaterThan(100);
 const sleeve=ps.find(p=>p.id==='leading-sleeve')!,P=sleeve.geometry.getAttribute('position'),I=sleeve.geometry.index!,planes=[];
 for(let i=0;i<(I?.count??P.count);i+=3){const vs=[0,1,2].map(j=>[P.getX(I?I.getX(i+j):i+j),P.getY(I?I.getX(i+j):i+j),P.getZ(I?I.getX(i+j):i+j)]);if(vs.filter(p=>p[0]===0&&p[1]===0).length!==2)continue;const a=vs[0]!,b=vs[1]!,c=vs[2]!,dx=b[0]!-a[0]!,dy=b[1]!-a[1]!,dz=b[2]!-a[2]!,ex=c[0]!-a[0]!,ey=c[1]!-a[1]!,ez=c[2]!-a[2]!;planes.push([dy*ez-dz*ey,dz*ex-dx*ez,dx*ey-dy*ex]);}
 expect(planes).toHaveLength(2);expect(planes.every(n=>n[0]!<0&&n[2]===0)).toBe(true);expect(planes[0]![1]!*planes[1]![1]!).toBeLessThan(0);
 // Actual packed face normals, not nominal facet angles: their positive
 // y-cancelling combination is a strict negative-X normal.
 const A=planes[0]!,B=planes[1]!,wa=Math.abs(B[1]!),wb=Math.abs(A[1]!);expect(wa*A[1]!+wb*B[1]!).toBe(0);expect(wa*A[0]!+wb*B[0]!).toBeLessThan(0);
 }finally{[...ps,...old].forEach(p=>p.geometry.dispose());}});
it('private seals reject clone, mutation, hidden range, index and normal corruption',()=>{for(const mutation of['clone','position','normal','index','trim']as const){const ps=axleHeadParts(()=>{});try{const g=ps[3]!.geometry;paint(g);sealAxleHeadColor(g,()=>{});const candidate=mutation==='clone'?g.clone():g;if(mutation==='position')g.getAttribute('position').setX(0,17);if(mutation==='normal')g.getAttribute('normal').setY(0,17);if(mutation==='index')g.index!.setX(0,17);if(mutation==='trim')g.setDrawRange(0,3);expect(()=>assertAxleHeadSource(candidate,()=>{})).toThrow();if(candidate!==g)candidate.dispose();}finally{ps.forEach(p=>p.geometry.dispose());}}});
it('entire declared subtraction domain is exact; .05 and the old .34 are distinct laws',()=>{expect(assertAxleHeadDomain(-.25,-.18).rho).toBe(VILLAGE_RADIUS);expect(cmp(exact(axleHeadOrigin(-.25)),sub(exact(VILLAGE_RADIUS),exact(.25)))).toBe(0);expect(cmp(exact(axleHeadOrigin(-.25)),exact(.05))).not.toBe(0);expect(cmp(sub(sub(exact(.34),exact(.3)),exact(.04)),rat(5n,2n**57n))).toBe(0);expect(()=>assertAxleHeadDomain(-.25,-.1)).toThrow();expect(()=>assertAxleHeadDomain(-.7,-.18)).toThrow();expect(cmp(exact(axleHeadOrigin(-.18)),add(exact(-.18),exact(VILLAGE_RADIUS)))).toBe(0);});

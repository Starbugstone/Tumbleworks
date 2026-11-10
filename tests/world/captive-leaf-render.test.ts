import{it,expect}from'vitest';import{Group,Mesh,MeshStandardMaterial,CylinderGeometry,DoubleSide}from'three';
import{retainerParts}from'../../src/view/retainer-parts';import{compactCylinderCaps}from'../../src/view/cylinder-caps';
import{trimEnclosedCaps}from'../../src/view/captive-enclosed-caps';import{captiveRenderGeometry}from'../../src/view/captive-weld-trims';
import{solidMoments}from'../../src/world/village-inventory';import{record55}from'./captive-leaf-record';import{Glass}from'../../src/engine/glass';
function fixture(){const parts=retainerParts('terracotta','keyed-prismatic'),root=new Group(),material=new MeshStandardMaterial(),meshes=new Map<string,Mesh>();for(const p of parts.filter(p=>p.body==='capture-head')){if(p.geometry instanceof CylinderGeometry)compactCylinderCaps(p.geometry);const m=new Mesh(p.geometry,material);m.userData.retainerPart={id:p.id,body:p.body};root.add(m);meshes.set(p.id,m);}return{parts,root,material,meshes,arm:meshes.get('lift-arm')!,dispose:()=>{parts.forEach(p=>p.geometry.dispose());material.dispose();}};}
it('proves exactly E1/E2 four triangles, strict margins/open rims, actual closed/manifold/outward/convex covers and unchanged exposed boundary',()=>{
 const f=fixture();try{record55('E1-E2-native-before',f.parts.map(p=>({id:p.id,body:p.body,position:Array.from(p.geometry.getAttribute('position').array),index:p.geometry.index?Array.from(p.geometry.index.array):null})));const before={position:Array.from(f.arm.geometry.getAttribute('position').array),normal:Array.from(f.arm.geometry.getAttribute('normal').array),mass:solidMoments(f.arm.geometry)},result=trimEnclosedCaps(f.arm,f.meshes);try{record55('E1-E2-native-parts',result.reports);expect(result.reports.map(r=>[r.cap,r.removedTriangles,r.rimEdges])).toEqual([['start',2,4],['end',2,4]]);expect(result.reports.every(r=>r.minimumMargin>r.requiredMargin&&r.exposedUnionBoundaryExact)).toBe(true);expect(Array.from(result.geometry.getAttribute('position').array)).toEqual(before.position);expect(Array.from(result.geometry.getAttribute('normal').array)).toEqual(before.normal);expect(solidMoments(f.arm.geometry)).toEqual(before.mass);expect(()=>solidMoments(result.geometry)).toThrow('untrimmed');}finally{result.geometry.dispose();}}finally{f.dispose();}
});
it.each(['transparent','depth-off','two-sided','polygon-offset','wrong-body','wrong-transform','wrong-index','outside-cap','open-cover','inward-cover','nonconvex-cover','on-boundary','different-material','scaled-transform']as const)('rejects %s; the caller must keep FULL caps and measured census failure',mutant=>{
 const f=fixture();try{const cover=f.meshes.get('leaf-shoe')!;
 if(mutant==='different-material')cover.material=f.material.clone();if(mutant==='scaled-transform')f.root.scale.setScalar(2);
 if(mutant==='nonconvex-cover'){const p=cover.geometry.getAttribute('position');p.setX(0,0);}
 if(mutant==='on-boundary'){const p=f.arm.geometry.getAttribute('position');for(let i=0;i<p.count;i++)if(Math.abs((p.getX(i)+p.getY(i))*Math.SQRT1_2+.01)<1e-6)p.setZ(i,-.97);}
 if(mutant==='transparent')f.material.transparent=true;if(mutant==='depth-off')f.material.depthWrite=false;if(mutant==='two-sided')f.material.side=DoubleSide;if(mutant==='polygon-offset')f.material.polygonOffset=true;
 if(mutant==='wrong-body')cover.userData.retainerPart.body='fork';if(mutant==='wrong-transform')cover.position.z=.01;
 if(mutant==='wrong-index'||mutant==='open-cover'){const ix=cover.geometry.index!;cover.geometry.setIndex(Array.from(ix.array).slice(3));}
 if(mutant==='inward-cover'){const ix=cover.geometry.index!,ids=Array.from(ix.array);[ids[0],ids[1]]=[ids[1]!,ids[0]!];cover.geometry.setIndex(ids);}
 if(mutant==='outside-cap'){const p=f.arm.geometry.getAttribute('position');p.setZ(0,-2);}
 const before=Array.from(f.arm.geometry.getAttribute('position').array);expect(()=>trimEnclosedCaps(f.arm,f.meshes)).toThrow();expect(Array.from(f.arm.geometry.getAttribute('position').array)).toEqual(before);
 }finally{const mat=f.meshes.get('leaf-shoe')!.material;if(!Array.isArray(mat)&&mat!==f.material)mat.dispose();f.dispose();}
});
it('keeps the six-triangle compact pin back-cap accounting and original closed inventory',()=>{
 const p=retainerParts('terracotta','keyed-prismatic');try{for(const id of['slider','key-pin']){const part=p.find(p=>p.id===id)!,before=(part.geometry.index?.count??part.geometry.getAttribute('position').count)/3,g=captiveRenderGeometry(part,p);try{expect(before-g.index!.count/3).toBe(id==='slider'?2:6);expect(()=>solidMoments(g)).toThrow('untrimmed');}finally{g.dispose();}}}finally{p.forEach(p=>p.geometry.dispose());}
});

it('rejects the actual two-sided Glass construction as an enclosed opaque weld',()=>{const f=fixture();const glass=new Glass(new MeshStandardMaterial({transparent:true,opacity:.5}));try{const shoe=f.meshes.get('leaf-shoe')!,group=glass.mesh(shoe.geometry);f.root.add(group);const front=group.children[1];if(!(front instanceof Mesh))throw new Error('Actual Glass mesh missing');front.userData.retainerPart={id:'leaf-shoe',body:'capture-head'};f.meshes.set('leaf-shoe',front);expect(()=>trimEnclosedCaps(f.arm,f.meshes)).toThrow();}finally{glass.back.dispose();glass.front.dispose();glass.flat.dispose();f.dispose();}});

it('repairs only declared opt-in sleeve endpoints, preserving the16-gon profile/envelope/facets and rejecting the old open seam',()=>{
 const f=fixture(),oldParts=retainerParts('terracotta','keyed-split'),old=oldParts.find(p=>p.id==='leading-sleeve')!.geometry,current=f.meshes.get('leading-sleeve')!.geometry;
 try{const a=old.getAttribute('position'),b=current.getAttribute('position'),delta=[];expect(a.count).toBe(b.count);for(let i=0;i<a.count;i++)for(let k=0;k<3;k++){const x=a.getComponent(i,k),y=b.getComponent(i,k);if(!Object.is(x,y))delta.push({vertex:i,component:k,before:x,after:y});}
 expect(delta.map(d=>d.vertex)).toEqual([16,33,66,99]);expect(delta.every(d=>d.component===0&&d.after===0&&Math.abs(d.before)<1e-16)).toBe(true);
 const before=Array.from(old.index!.array);compactCylinderCaps(old as CylinderGeometry);expect(before.length).toBe(192);expect(Array.from(old.index!.array)).toEqual(Array.from(current.index!.array));
 record55('sleeve-literal-closure-delta',{delta,rawTriangles:before.length/3,renderTriangles:current.index!.count/3,closedBefore:solidMoments(old),closedAfter:solidMoments(current)});
 const mesh=f.meshes.get('leading-sleeve')!,saved=mesh.geometry;try{mesh.geometry=old;expect(()=>trimEnclosedCaps(f.arm,f.meshes)).toThrow('closed producer');}finally{mesh.geometry=saved;}
 }finally{oldParts.forEach(p=>p.geometry.dispose());f.dispose();}
});

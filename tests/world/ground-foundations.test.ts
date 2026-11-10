import{BoxGeometry,Mesh,Group}from'three';import{expect,it}from'vitest';
import{postBraceGeometry}from'../../src/view/retained-support';import{groundFoundations}from'./ground-foundations';
it('enumerates an exact union post and a complete fitted sloping foot',()=>{
 const root=new Group(),flat=postBraceGeometry(0,.6,0,.12,()=>2,()=>0)!;
 const sloped=new BoxGeometry(.38,2,.38).translate(2,1,0),p=sloped.getAttribute('position');
 const soil=(x:number,z:number)=>x>1?.2*(x-2)+.1*z:0;
 for(let i=0;i<p.count;i++)if(p.getY(i)<1)p.setY(i,soil(p.getX(i),p.getZ(i)));sloped.computeVertexNormals();
 root.add(new Mesh(flat),new Mesh(sloped));
 try{
  const feet=groundFoundations([root],soil);expect(feet.length).toBe(2);
  for(const f of feet)for(const triangle of f.bottom)for(const v of triangle)expect(Math.abs(v.y-soil(v.x,v.z))).toBeLessThan(1e-7);
  expect(feet[0]!.bottom.length).toBeGreaterThan(0);expect(feet[1]!.bottom.length).toBe(2);
  sloped.translate(0,.01,0);expect(groundFoundations([root],soil).length).toBe(1);
 }finally{flat.dispose();sloped.dispose();}
});

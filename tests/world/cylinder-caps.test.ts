import { CylinderGeometry, Mesh, Triangle, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { compactCylinderCaps } from '../../src/view/cylinder-caps';
import { surfaceTriangles } from './surface-overlap';

it.each([3,6,8,10,16,32])('retains both oriented cap polygons and every curved face for %i sides', n => {
 for(const transform of [false,true]){
  const g=new CylinderGeometry(.04,.07,.56,n);
  if(transform)g.rotateX(.7).rotateZ(-.18).translate(-.68,.21,-.9);
  const before=g.clone(),attributes=Object.fromEntries(Object.entries(g.attributes).map(([k,v])=>[k,Array.from(v.array)]));
  const curved=Array.from(g.index!.array).slice(0,g.groups[0]!.count);
  compactCylinderCaps(g);
  expect(g.index!.count).toBe(before.index!.count-12);
  expect(Array.from(g.index!.array).slice(0,curved.length)).toEqual(curved);
  for(const [k,v]of Object.entries(g.attributes))expect(Array.from(v.array)).toEqual(attributes[k]);
  const a=surfaceTriangles(new Mesh(before)),b=surfaceTriangles(new Mesh(g));
  const area=(faces:typeof a)=>faces.reduce((sum,t)=>sum+new Triangle(t.a,t.b,t.c).getArea(),0);
  expect(area(a)).toBeCloseTo(area(b),8);
  const p=g.getAttribute('position');let magnitude=1;for(let i=0;i<p.count;i++)magnitude=Math.max(magnitude,Math.abs(p.getX(i)),Math.abs(p.getY(i)),Math.abs(p.getZ(i)));
  const storageBound=8*2**-24*magnitude,nearest=new Vector3();
  for(const [from,to]of[[a,b],[b,a]])for(const t of from!)for(const point of[t.a,t.b,t.c,new Triangle(t.a,t.b,t.c).getMidpoint(new Vector3())]){
   expect(Math.min(...to!.filter(other=>other.normal.dot(t.normal)>.999999).map(other=>new Triangle(other.a,other.b,other.c).closestPointToPoint(point,nearest).distanceTo(point)))).toBeLessThan(storageBound);
  }
  before.dispose();g.dispose();
 }
});
it('leaves partial and open cylinders unchanged',()=>{
 for(const g of[new CylinderGeometry(.1,.1,1,8,1,true),new CylinderGeometry(.1,.1,1,8,1,false,0,Math.PI)]){
  const before=Array.from(g.index!.array);compactCylinderCaps(g);expect(Array.from(g.index!.array)).toEqual(before);g.dispose();
 }
});

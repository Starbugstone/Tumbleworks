import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { expect, it } from 'vitest';
import { surfaceTriangles } from './surface-overlap';
import { profileHardwareCrossings, retainedEndpointWeld } from './village-profile-joints';
import { triangleCrossing } from './village-geometry';

it('only explicit finite endpoint welds are intentional; same body/name or a later foreign pair is not exempt',()=>{
 const parent=new Group();parent.name='village-9-fork';const material=new MeshBasicMaterial();
 const a=new Mesh(new BoxGeometry(.1,.04,.04).translate(0,0,-.7),material),b=new Mesh(new BoxGeometry(.04,.1,.04).translate(0,0,-.7),material);
 a.name='leading-return';b.name='tie';a.userData.retainerPart={id:'leading-return'};b.userData.retainerPart={id:'tie'};parent.add(a,b);
 try {
  const crossing=()=>{const first=surfaceTriangles(a),second=surfaceTriangles(b);return first.flatMap(a=>second.filter(b=>triangleCrossing(a,b)||triangleCrossing(b,a)).map(b=>({a,b})));};
  expect(crossing().length).toBeGreaterThan(0);expect(crossing().every(p=>retainedEndpointWeld(p.a,p.b))).toBe(true);
  a.position.x=b.position.x=.2;
  expect(crossing().every(p=>!retainedEndpointWeld(p.a,p.b))).toBe(true);
  a.position.x=b.position.x=0;delete b.userData.retainerPart;
  expect(crossing().every(p=>!retainedEndpointWeld(p.a,p.b))).toBe(true);
  b.userData.retainerPart={id:'tie'};
  const foreign=new Mesh(b.geometry,material);foreign.name='foreign-overlapping-same-body';parent.add(foreign);
  expect(profileHardwareCrossings(surfaceTriangles(a),surfaceTriangles(parent)).some(c=>c.b===foreign.name)).toBe(true);
 }finally{a.geometry.dispose();b.geometry.dispose();material.dispose();}
});

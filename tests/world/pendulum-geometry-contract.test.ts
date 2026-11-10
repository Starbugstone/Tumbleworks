import{expect,it}from'vitest';
import{BoxGeometry,Group,Mesh}from'three';
import{pendulumCrossings}from'./pendulum-proof-geometry';
import{surfaceTriangles}from'./surface-overlap';
import{recontactFixture}from'./pendulum-recontact-fixture';
it('strict full-solid crossings retain sub-.002 foreign and displaced named-weld negatives',()=>{
 const f=recontactFixture(),parent=new Group(),a=new Mesh(new BoxGeometry(.001,.01,.01)),b=new Mesh(new BoxGeometry(.01,.001,.01));parent.add(a,b);a.name='actual-part';b.name='foreign-part';a.userData.pendulumPart={id:'striking-bar',body:'hammer'};parent.updateMatrixWorld(true);
 try{
  const all=surfaceTriangles(parent),hardware=all.filter(t=>t.mesh===a);expect(pendulumCrossings(hardware,all,f.drive,.04).length).toBeGreaterThan(0);
  b.userData.pendulumPart={id:'bar-return',body:'hammer'};expect(pendulumCrossings(hardware,all,f.drive,.04).length).toBeGreaterThan(0); // same parent/declared pair cannot forgive a displaced joint
 }finally{a.geometry.dispose();b.geometry.dispose();f.dispose();}
});

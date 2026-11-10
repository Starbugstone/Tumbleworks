import{Group,Matrix4,Mesh,BoxGeometry,Vector3}from'three';
import{expect,it}from'vitest';
import{manualPendulumPose}from'./pendulum-fixture';
import{surfaceTriangles}from'./surface-overlap';
it('manual packed-part probes refresh after repeated writes and a transformed parent',()=>{
 const parent=new Group(),mesh=new Mesh(new BoxGeometry(1,1,1));parent.add(mesh);parent.position.set(4,3,-2);parent.rotation.z=.4;parent.updateWorldMatrix(true,true,true);
 try{
  manualPendulumPose(mesh,new Matrix4().makeTranslation(1,0,0));const old=mesh.matrixWorld.clone();
  // Negative control: a raw matrix write without the dirty bit preserves stale
  // world coordinates in the pinned Three version.
  mesh.matrix.makeTranslation(2,0,0);mesh.updateWorldMatrix(true,false);expect(mesh.matrixWorld.elements).toEqual(old.elements);
  manualPendulumPose(mesh,new Matrix4().makeTranslation(2,0,0));
  const expected=new Vector3(-.5,-.5,.5).applyMatrix4(mesh.matrix).applyMatrix4(parent.matrixWorld);
  expect(surfaceTriangles(mesh).some(t=>[t.a,t.b,t.c].some(p=>p.distanceTo(expected)<1e-12))).toBe(true);
  expect(mesh.matrixWorld.elements).not.toEqual(old.elements);
  manualPendulumPose(mesh,new Matrix4().makeTranslation(-1,0,0));const expected2=new Vector3(0,0,0).applyMatrix4(parent.matrixWorld.clone().multiply(mesh.matrix));
  expect(new Vector3().setFromMatrixPosition(mesh.matrixWorld).distanceTo(expected2)).toBeLessThan(1e-12);
 }finally{mesh.geometry.dispose();}
});

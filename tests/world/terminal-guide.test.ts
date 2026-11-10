import {Matrix4,Mesh,Triangle,Vector3} from 'three';
import {expect,it,vi} from 'vitest';
import * as parts from '../../src/view/terminal-guide-parts';
import {TerminalGuideBrake} from '../../src/world/village-terminal-guide';
import {surfaceTriangles} from './surface-overlap';

const t=new Vector3(1,-.2,-.4).normalize(),n=new Vector3(0,1,0).addScaledVector(t,-t.y).normalize();
const frame=new Matrix4().makeBasis(t,n,new Vector3().crossVectors(t,n)).setPosition(9.6,2.4,-.5);
it('a finite closed collar has six opposed actual contacts throughout the complete stroke',()=>{
 const brake=TerminalGuideBrake.enrol(0,frame,.3,2);expect(brake.capacity).toBe(2);
 const p=parts.terminalGuideParts(frame,.3);
 try{
  const collar=new Mesh(p.collar),rod=new Mesh(p.rod),surfaces=surfaceTriangles(rod),nearest=new Vector3();
  for(let i=0;i<=120;i++){
   const q=.3*i/120;collar.matrixAutoUpdate=false;collar.matrix.copy(frame).multiply(new Matrix4().makeTranslation(q,0,0));collar.updateMatrixWorld(true);
   const faces=surfaceTriangles(collar);
   for(let side=0;side<6;side++)for(const x of[-.04,0,.04]){
    const angle=(side+.5)*Math.PI/3,r=.035*Math.cos(Math.PI/6);
    const point=new Vector3(q+x,-.55-r*Math.sin(angle),.65+r*Math.cos(angle)).applyMatrix4(frame);
    const distance=(a:typeof faces)=>Math.min(...a.map(f=>new Triangle(f.a,f.b,f.c).closestPointToPoint(point,nearest).distanceTo(point)));
    expect(distance(faces)).toBeLessThan(2e-6);expect(distance(surfaces)).toBeLessThan(2e-6);
   }
  }
  expect(p.collar.index?.count??p.collar.getAttribute('position').count).toBe(120);
 }finally{p.collar.dispose();p.rod.dispose();}
});
it('separated collar and guide mutants cannot enrol a rated brake',()=>{
 const factory=parts.terminalGuideParts;
 for(const role of['collar','rod']as const){
  const spy=vi.spyOn(parts,'terminalGuideParts').mockImplementation((...args)=>{const p=factory(...args);p[role].translate(0,.01,0);return p;});
  try{expect(()=>TerminalGuideBrake.enrol(0,frame,.3,2)).toThrow(/terminal-guide/);}finally{spy.mockRestore();}
 }
 expect(()=>TerminalGuideBrake.enrol(0,frame,.3,0)).toThrow();
});

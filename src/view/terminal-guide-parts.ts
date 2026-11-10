import { CylinderGeometry, ExtrudeGeometry, Matrix4, Path, Shape, Vector3 } from 'three';

export const TERMINAL_GUIDE_MARGIN = .1;
/** A single closed collar on the actual six-sided guide. The finite overhang
 * keeps both fixed end braces outside the collar's complete stroke.
 */
export function terminalGuideParts(frame:Matrix4,stroke:number){
  if(!Number.isFinite(stroke)||stroke<=0)throw new Error('Finite terminal guide stroke required');
  const shape=new Shape();
  for(const [i,[z,y]]of [[.53,-.62],[.77,-.62],[.77,-.48],[.53,-.48]].entries())i?shape.lineTo(z!,y!):shape.moveTo(z!,y!);
  shape.closePath();const hole=new Path();
  for(let i=0;i<6;i++){
    const theta=i*Math.PI/3,z=.65+.035*Math.cos(theta),y=-.55-.035*Math.sin(theta);
    if(i)hole.lineTo(z,y);else hole.moveTo(z,y);
  }
  hole.closePath();shape.holes.push(hole);
  const collar=new ExtrudeGeometry(shape,{depth:.1,steps:1,bevelEnabled:false}),p=collar.getAttribute('position');
  for(let i=0;i<p.count;i++)p.setXYZ(i,p.getZ(i)-.05,p.getY(i),p.getX(i));
  const indices:number[]=[];for(let i=0;i<p.count;i+=3)indices.push(i,i+2,i+1);collar.setIndex(indices);collar.computeVertexNormals();
  const rod=new CylinderGeometry(.035,.035,stroke+2*TERMINAL_GUIDE_MARGIN,6).rotateZ(-Math.PI/2)
    .translate(stroke/2,-.55,.65).applyMatrix4(frame);
  return{collar,rod,axis:new Vector3(0,-.55,.65),radius:.035,halfLength:.05};
}

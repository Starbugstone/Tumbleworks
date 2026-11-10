import { Matrix4,Ray,Triangle,Vector3,type BufferGeometry } from 'three';
import { terminalGuideParts } from '../view/terminal-guide-parts';
import { VillageAdmissibilityError } from './village-contact';

/** Ideal rigid prismatic contacts. Six opposed finite patches span transverse
 * forces and all moments; the single rated shoe supplies axial dissipation.
 */
export class TerminalGuideBrake {
  private constructor(readonly stop:number,readonly capacity:number) {Object.freeze(this);}
  static enrol(stop:number,frame:Matrix4,stroke:number,capacity:number):TerminalGuideBrake {
    if(!Number.isFinite(capacity)||capacity<=0)throw new Error('Finite terminal shoe rating required');
    const parts=terminalGuideParts(frame,stroke),inverse=frame.clone().invert();
    try{
      const triangles=(g:BufferGeometry,m:Matrix4)=>{const p=g.getAttribute('position'),i=g.index,faces:Triangle[]=[];
        for(let j=0;j<(i?.count??p.count);j+=3)faces.push(new Triangle(...[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,i?i.getX(j+k):j+k).applyMatrix4(m))as[Vector3,Vector3,Vector3]));return faces;};
      const collar=triangles(parts.collar,new Matrix4()),rod=triangles(parts.rod,inverse),ray=new Ray(),hit=new Vector3(),normal=new Vector3();
      // Transform packing is bounded separately from the physical contact law.
      const storage=16*2**-24*Math.max(1,...new Vector3().setFromMatrixPosition(frame).toArray().map(Math.abs));
      for(const travel of[0,stroke])for(const along of[-.04,0,.04])for(let facet=0;facet<6;facet++){
        const angle=(facet+.5)*Math.PI/3,direction=new Vector3(0,-Math.sin(angle),Math.cos(angle));
        const distance=(faces:Triangle[],x:number)=>{
          ray.set(parts.axis.clone().add(new Vector3(x,0,0)),direction);let closest=Infinity,dot=0;
          for(const face of faces)if(ray.intersectTriangle(face.a,face.b,face.c,false,hit)){const d=hit.distanceTo(ray.origin);if(d<closest){closest=d;dot=face.getNormal(normal).dot(direction);}}
          return{closest,dot};
        };
        const jaw=distance(collar,along),guide=distance(rod,along+travel),expected=parts.radius*Math.cos(Math.PI/6);
        if(Math.abs(jaw.closest-expected)>storage||Math.abs(guide.closest-expected)>storage||jaw.dot>-.99999||guide.dot<.99999)
          throw new VillageAdmissibilityError(stop,'terminal-guide','unsupported-contact-geometry',Math.max(Math.abs(jaw.closest-expected),Math.abs(guide.closest-expected)),storage,'Actual opposed terminal guide face missing');
      }
      return new TerminalGuideBrake(stop,capacity);
    }finally{parts.collar.dispose();parts.rod.dispose();}
  }
}

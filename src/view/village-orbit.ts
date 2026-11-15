import { Box3, MathUtils, PerspectiveCamera, Vector3 } from 'three';

/** Inspection pose is independent of the film's authored camera and endpoints. */
export class VillageOrbit {
  yaw = -.22;
  elevation = Math.PI / 4;
  zoom = 1;
  readonly pan = new Vector3();
  private distance = 70;
  private readonly target = new Vector3();
  private readonly center = new Vector3();
  private readonly offset = new Vector3();
  constructor(private readonly bounds: Box3, private readonly points?: readonly Vector3[]) { bounds.getCenter(this.center); }
  reset(): void { this.yaw=-.22;this.elevation=Math.PI/4;this.zoom=1;this.pan.set(0,0,0); }
  get changed(): boolean {return Math.abs(this.yaw+.22)>.001||Math.abs(this.elevation-Math.PI/4)>.001||Math.abs(this.zoom-1)>.001||this.pan.lengthSq()>.001;}
  rotate(dx: number,dy: number):void{this.yaw+=dx*.009;this.elevation=MathUtils.clamp(this.elevation+dy*.006,Math.PI*32/180,Math.PI*72/180);}
  magnify(ratio: number):void{if(Number.isFinite(ratio)&&ratio>0)this.zoom=MathUtils.clamp(this.zoom*ratio,.8,2.5);}
  move(dx:number,dy:number,height:number):void{
    const units=this.distance/this.zoom*.6/height,c=Math.cos(this.yaw),s=Math.sin(this.yaw);
    this.pan.x=MathUtils.clamp(this.pan.x-dx*c*units-dy*s*units,-this.bounds.getSize(this.offset).x*.45,this.offset.x*.45);
    this.pan.z=MathUtils.clamp(this.pan.z+dx*s*units-dy*c*units,-this.offset.z*.45,this.offset.z*.45);
  }
  fit(aspect:number,height:number):void{
    const yaw=-.22,elevation=Math.PI/4,tan=Math.tan(34*Math.PI/360),s=Math.sin(yaw),c=Math.cos(yaw),se=Math.sin(elevation),ce=Math.cos(elevation);
    const safeY=Math.max(.3,1-260/height);let distance=0;
    const points=this.points??Array.from({length:8},(_,i)=>new Vector3(i&1?this.bounds.max.x:this.bounds.min.x,i&2?this.bounds.max.y:this.bounds.min.y,i&4?this.bounds.max.z:this.bounds.min.z));
    for(const point of points){
      const x=point.x-this.center.x,y=point.y-this.center.y,z=point.z-this.center.z;
      const horizontal=c*x-s*z,vertical=-se*s*x+ce*y-se*c*z,forward=ce*s*x+se*y+ce*c*z;
      distance=Math.max(distance,forward+Math.abs(horizontal)/(tan*aspect*.88),forward+Math.abs(vertical)/(tan*safeY));
    }
    this.distance=distance;
  }
  apply(camera:PerspectiveCamera):void{
    this.target.copy(this.center).add(this.pan);
    const distance=this.distance/this.zoom,horizontal=Math.cos(this.elevation)*distance;
    camera.position.set(this.target.x+Math.sin(this.yaw)*horizontal,this.target.y+Math.sin(this.elevation)*distance,this.target.z+Math.cos(this.yaw)*horizontal);
    camera.lookAt(this.target);camera.zoom=1;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  }
}

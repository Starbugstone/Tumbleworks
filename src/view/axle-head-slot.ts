// Mill111 selected axle implementation. Real prismatic side faces, built from the actual packed reflected slider.
// Bare top/bottom boxes cannot supply My during the offset-head capture impulse.
import {Matrix4,Vector3,type BufferGeometry}from'three';
import{prism}from'./axle-solid';
export function axleHeadSlot(slider:BufferGeometry,first:number,last:number){const p=slider.getAttribute('position'),xs:number[]=[],ys:number[]=[],zs:number[]=[];for(let i=0;i<p.count;i++){xs.push(p.getX(i));ys.push(p.getY(i));zs.push(p.getZ(i));}const yl=Math.min(...ys),yh=Math.max(...ys),zl=Math.min(...zs),zh=Math.max(...zs),thickness=.02,frame=new Matrix4().makeBasis(new Vector3(0,0,1),new Vector3(0,-1,0),new Vector3(1,0,0));
 const extrude=(outline:readonly(readonly[number,number])[])=>prism(outline.map(([z,y])=>[z,-y]as const),[],first+Math.min(...xs)-.01,last+Math.max(...xs)+.01).applyMatrix4(frame);
 const opening=.0145,lower=extrude([[zl-thickness,yl-thickness],[zh+thickness,yl-thickness],[zh+thickness,-opening],[zh,-opening],[zh,yl],[zl,yl],[zl,-opening],[zl-thickness,-opening]]),upper=extrude([[zl-thickness,opening],[zl,opening],[zl,yh],[zh,yh],[zh,opening],[zh+thickness,opening],[zh+thickness,yh+thickness],[zl-thickness,yh+thickness]]);
 return{lower,upper,faces:{y:[yl,yh],z:[zl,zh],stroke:[first,last],sections:[-.0175,.0175],keyPassage:opening},model:'actual finite opposed planar slider faces, no nominal-clearance exemption'};
}

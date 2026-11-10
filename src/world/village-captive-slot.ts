import{CAPTIVE_SLOT,captiveTop,SLOT_C as C,SLOT_S as S}from'../view/captive-slot-profile';
export type V3=readonly[number,number,number];
export interface SlotWrench{readonly force:V3;readonly moment:V3}
export interface SlotRow{readonly face:'B'|'T'|'R'|'J2'|'J3';readonly point:V3;readonly force:V3;readonly magnitude:number}
const A=.03,Z=-.9,D=.015,cross=(r:V3,f:V3):V3=>[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
const row=(face:SlotRow['face'],point:V3,force:V3):SlotRow=>Object.freeze({face,point:Object.freeze(point),force:Object.freeze(force),magnitude:Math.hypot(...force)});
/** Selected G-R58 signed basis. All moments are about the axle O. No friction
 * row has an independently assigned couple; it is ONE axial resultant. */
export function slotReactions(E:SlotWrench,axial:number,site:'J2'|'J3',point:V3):readonly SlotRow[]{
 if(E.force[2]!==0||E.force[0]!==axial||![...E.force,...E.moment,axial].every(Number.isFinite)||!(S>0&&C>0))throw new Error('Invalid captive slot wrench/axial resultant/wedge');
 const rows:SlotRow[]=[];if(axial)rows.push(row(site,point,[axial,0,0]));const ma=cross(point,[axial,0,0]),Fy=E.force[1],Mx=E.moment[0]-ma[0],My=E.moment[1]-ma[1],Mz=E.moment[2]-ma[2];
 for(const[x,f]of[[A,-My/(2*A)],[-A,My/(2*A)]]as const){if(f>0){rows.push(row('T',[x,captiveTop(Z),Z],[0,-C*f/S,f]));rows.push(row('B',[x,CAPTIVE_SLOT.floor,Z],[0,C*f/S,0]));}else if(f<0)rows.push(row('R',[x,captiveTop(Z),CAPTIVE_SLOT.back],[0,0,f]));}
 for(const sx of[-1,1])for(const sz of[-1,1]){const x=sx*A,z=Z+sz*D,Y=Fy/4+sx*Mz/(4*A)-sz*(Mx+Z*Fy)/(4*D);if(Y>0)rows.push(row('B',[x,CAPTIVE_SLOT.floor,z],[0,Y,0]));else if(Y<0){const m=-Y;rows.push(row('T',[x,captiveTop(z),z],[0,-m,m*S/C]));rows.push(row('R',[x,captiveTop(z),CAPTIVE_SLOT.back],[0,0,-m*S/C]));}}
 let scale=1;const force=[0,0,0],moment=[0,0,0];for(const r of rows){if(!(r.magnitude>=0)||!r.force.every(Number.isFinite))throw new Error('Invalid nonnegative contact row');for(let i=0;i<3;i++){force[i]!+=r.force[i]!;moment[i]!+=cross(r.point,r.force)[i]!;}scale+=r.magnitude*(1+Math.hypot(...r.point));}
 const bound=128*Number.EPSILON*scale;if(force.some((v,i)=>Math.abs(v-E.force[i]!)>bound)||moment.some((v,i)=>Math.abs(v-E.moment[i]!)>bound))throw new Error('Actual B/T/R Newton-Euler reconstruction failed');assertAxialResultantOnly(rows,site==='J3'?axial:0);return Object.freeze(rows);
}
/** Regression seam for the retired brake-moment construction. */
export function assertAxialResultantOnly(rows:readonly SlotRow[],axial:number):void {
 const friction=rows.filter(r=>r.face==='J3');if(friction.length>(axial===0?0:1))throw new Error('A finite axial shoe cannot be replaced by a brake couple');
 for(const r of friction)if(r.force[0]!==axial||r.force[1]!==0||r.force[2]!==0||r.point[0]!==0||r.point[1]!==CAPTIVE_SLOT.floor||r.point[2]!==-.9)throw new Error('Brake is not the single declared axial resultant');
}

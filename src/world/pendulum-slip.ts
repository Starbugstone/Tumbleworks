import { VillageAdmissibilityError, VILLAGE_CONTACT, assertContact } from './village-contact';
/** Exact post-separation flat-floor phase, spin measured as R*omega. No spin
 * impulse or resetting to rolling speed; the equality is reached in finite time. */
export function flatSlip(stop:number,v:number,w:number,available:number){
 const m=.02,k=.4,R=.3,relative=v-w,a=relative===0?0:-VILLAGE_CONTACT.mu*9.81*Math.sign(relative);
 const duration=relative===0?0:-relative/(a*(1+1/k)),distance=v*duration+.5*a*duration**2;
 const endSpeed=v+a*duration,endSpin=w-a*duration/k,angle=(w*duration-.5*a*duration**2/k)/R;
 const loss=-m*a*relative*duration/2,residual=.5*m*(v*v+k*w*w)-.5*m*(endSpeed**2+k*endSpin**2)-loss;
 if(!(endSpeed>0))throw new VillageAdmissibilityError(stop,'striker-stall','unsupported-contact-geometry',1,0);
 if(distance>available)throw new VillageAdmissibilityError(stop,'striker-slip','stroke',distance,available);
 assertContact(stop,'striker-slip','energy-balance',Math.abs(residual),128*Number.EPSILON*Math.max(1,.5*m*(v*v+k*w*w)));
 return Object.freeze({duration,distance,endSpeed,endSpin,angle,loss,residual,acceleration:a,normal:m*9.81,friction:m*a});
}

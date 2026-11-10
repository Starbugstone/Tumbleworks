import {ExtrudeGeometry,Shape,Vector2}from'three';
import {journalRingGeometry}from'./pendulum-parts';

/** A real annular friction wheel: its fixed shaft occupies the clear bore. */
export function cinematicClockWheel(){return journalRingGeometry(.025,.18,.08,-.04).rotateY(Math.PI/2);}

/** One closed L-shaped follower. It seats on the rotor and joins the gate stem,
 * while the opposite side of the rotor remains clear for the friction wheel. */
export function cinematicClockFollower(){
 const outline=[[-.39,-.78],[-.31,-.78],[-.31,-.34],[.04,-.34],[.04,-.26],[-.39,-.26]];
 return new ExtrudeGeometry(new Shape(outline.map(([x,z])=>new Vector2(x!,z!))),{depth:.08,steps:1,bevelEnabled:false}).rotateX(Math.PI/2).translate(0,.775,0);
}

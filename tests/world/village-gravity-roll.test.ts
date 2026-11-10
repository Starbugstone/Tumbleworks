import { expect,it } from 'vitest';
import { compileGravityLever } from '../../src/world/village-gravity-roll';
const assembly={pivot:[-.8,-.8,0] as const,angle:-.35,deckPitch:0,entryX:-.8,exitX:.8,radius:.3,inertiaFactor:1.4};
const spec={marbleMass:.02,bodyMass:.012,bodyInertia:.0104,bodyCentre:[0,-.46,0] as const,tripX:-.55,bearingTorque:.0002,restitution:0,traction:.8};
it('solves gravity, body inertia and supported rolling without an authored clock',()=>{
 const motion=compileGravityLever(assembly,spec,0,1);
 expect(motion.stopNormalImpulse).toBeGreaterThan(0);
 expect(Math.abs(motion.stopTangentialImpulse)).toBeLessThanOrEqual(spec.traction*motion.stopNormalImpulse);
 expect(motion.exitSpeed).toBeGreaterThan(0);expect(motion.stopLoss).toBeGreaterThan(0);
 expect(motion.rows.at(-1)!.angle).toBe(assembly.angle);
 expect(motion.rows.every(row=>row.energy<=motion.initialEnergy+1e-6&&row.reaction>0)).toBe(true);
});
it('rejects a marble that reaches an undocked lip instead of slowing its clock',()=>{
 expect(()=>compileGravityLever(assembly,{...spec,bodyInertia:1},0,8)).toThrow(/before docking/);
});

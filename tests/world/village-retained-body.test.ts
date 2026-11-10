import {expect,it} from 'vitest';
import {VillageRetained} from '../../src/world/village-retained';
import {mechanismPorts} from '../../src/view/machine-primitives';
import {CLOCKMAKERS_HILL} from '../../src/world/villages/clockmakers-hill';
it('requires launcher block mass geometry and uses central inertia without a second parallel-axis term',()=>{
 const original=CLOCKMAKERS_HILL.plan.stations.find(s=>s.stop===2)!;
 const mechanism={kind:'launcher' as const,pivot:[-.8,-.5,0] as const,axis:[0,0,1] as const,angle:-.3,deckPitch:-.18};
 const base={...original,mechanism,...mechanismPorts(mechanism,original.anchor)};
 expect(()=>new VillageRetained(base,0,1,1.4,'terracotta')).toThrow(/COM/);
 const station={...base,retention:{...base.retention!,bodyMass:.012,bodyCentre:[-.5,-.7666666666666667,0] as const,bodyInertia:.009666666666666667}};
 // Correct central inertia is necessary, but does not enrol a rotating body in
 // the fixed-orientation carry torque proof.
 expect(()=>new VillageRetained(station,0,1,1.4,'terracotta')).toThrow(/retained-support unsupported-contact-geometry/);
});

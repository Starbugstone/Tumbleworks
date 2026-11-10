import {expect,it} from 'vitest';
import {VillageRetained} from '../../src/world/village-retained';
import {CLOCKMAKERS_HILL} from '../../src/world/villages/clockmakers-hill';
it.each([6,2,1])('Clock %s rail capture cannot borrow a single-floor impulse or torque proof',stop=>{
 const station=CLOCKMAKERS_HILL.plan.stations.find(s=>s.stop===stop)!;
 expect(()=>new VillageRetained(station,0,4,1+.4/(1-(.22/.355)**2),'twinrail')).toThrow(/retained-support unsupported-contact-geometry/);
});

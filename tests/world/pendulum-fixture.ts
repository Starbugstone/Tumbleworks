import type { VillageStation } from '../../src/world/village-plan';
import { villagePort } from '../../src/world/village-plan';
import type { Matrix4,Object3D } from 'three';
/** Three r187 manual matrix writes need a forced world refresh. This helper is
 * deliberately local to the owned pendulum geometry fixtures. */
export function manualPendulumPose(object:Object3D,matrix:Matrix4):void{
 object.matrixAutoUpdate=false;object.matrix.copy(matrix);object.matrixWorldNeedsUpdate=true;
 object.updateWorldMatrix(true,true,true);
}
/** Explicit flat isolated fixture; no village registry, terrain, route compile,
 * WorldScene, fake captured actor or real-route acceptance is imported here. */
export const pendulumStation:VillageStation={stop:1,anchor:[7.4,1.5,7.5],badge:[7,2,10],mechanism:{kind:'striker',travel:.5},entry:villagePort([6.6,1.5,7.5]),exit:villagePort([8.2,1.5,7.5]),start:0,contact:0,end:1,color:0xd6b27a};

import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { separateMapPins } from '../../src/view/map-pins';
import { VillageOrbit } from '../../src/view/village-orbit';

it('supports complete rotations, bounded tilt/zoom and pan, then restores the exact default', () => {
  const orbit = new VillageOrbit(new Box3(new Vector3(-12,0,-16),new Vector3(12,10,16)));
  const camera=new PerspectiveCamera(34,375/690,.1,220);orbit.fit(camera.aspect,690);orbit.apply(camera);
  const initial=camera.matrixWorld.toArray();
  orbit.rotate(1000,1000);orbit.magnify(99);orbit.move(100000,100000,690);orbit.apply(camera);
  expect(orbit.yaw).toBeGreaterThan(Math.PI*2);expect(orbit.elevation).toBeCloseTo(Math.PI*72/180);expect(orbit.zoom).toBe(2.5);
  expect(Math.abs(orbit.pan.x)).toBeLessThanOrEqual(10.8);expect(Math.abs(orbit.pan.z)).toBeLessThanOrEqual(14.4);
  const inspection=camera.matrixWorld.toArray();orbit.apply(camera);expect(camera.matrixWorld.toArray()).toEqual(inspection);
  orbit.rotate(0,-9999);orbit.magnify(.00001);expect(orbit.zoom).toBe(.8);expect(orbit.elevation).toBeCloseTo(Math.PI*32/180);
  orbit.reset();orbit.apply(camera);expect(camera.matrixWorld.toArray()).toEqual(initial);expect(orbit.changed).toBe(false);
});


it('keeps neighbouring progress pins clear of each 44px touch floor',()=>{
  const points=[{x:180,y:300},{x:185,y:305},{x:190,y:310},{x:180,y:311},{x:175,y:320}];
  const separated=separateMapPins(points,375,690);
  expect(separated[0]).toEqual(points[0]);
  for(let i=0;i<separated.length;i++)for(const q of separated.slice(i+1))expect(Math.hypot(separated[i]!.x-q.x,separated[i]!.y-q.y)).toBeGreaterThanOrEqual(45);
});

import { Box3, Float32BufferAttribute, PerspectiveCamera, Vector3 } from 'three';
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


it('fits the packed island vertices to the same phone margins as the traced mesh', () => {
  const vertices = new Float32BufferAttribute([-9,.2,4, 3,5,-12, 8,1,7, 3,5,-12], 3);
  const bounds = new Box3().setFromBufferAttribute(vertices), center = bounds.getCenter(new Vector3());
  const orbit = new VillageOrbit(bounds, vertices), camera = new PerspectiveCamera(34,375/690,.01,1000);
  orbit.fit(camera.aspect,690); orbit.apply(camera);
  const horizontal = camera.getWorldDirection(new Vector3()).cross(camera.up).normalize();
  const forward = camera.getWorldDirection(new Vector3()).negate(), up = forward.clone().cross(horizontal);
  const tan = Math.tan(34 * Math.PI / 360);
  let required = 0;
  for (let i = 0; i < vertices.count; i++) {
    const point = new Vector3().fromBufferAttribute(vertices,i).sub(center), depth = point.dot(forward);
    required = Math.max(required,depth+Math.abs(point.dot(horizontal))/(tan*camera.aspect*.88),
      depth+Math.abs(point.dot(up))/(tan*(1-260/690)));
  }
  expect(camera.position.distanceTo(center)).toBeCloseTo(required,10);
});

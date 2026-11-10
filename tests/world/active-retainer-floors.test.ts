import { describe, expect, it } from 'vitest';
import { Ray, Vector3 } from 'three';
import { VILLAGE_RADIUS } from '../../src/world/village-plan';
import { intendedFloorHit } from './active-retainer-floors';
import { adjacentFloorNames, type FloorTopology } from './active-retainer-floors';

const topology: FloorTopology = {
  stations: [{ stop: 8, mechanism: { kind: 'channel', points: [] } }, { stop: 7, mechanism: { kind: 'tipping' } }, { stop: 6, mechanism: { kind: 'channel', points: [] } }],
  connectors: [{ from: 8, to: 7 }, { from: 7, to: 6 }],
};
describe('G-J explicit downstream registration with the ORIGINAL local geometric guard', () => {
  it('adds exactly the real adjacent destination, not a numerical/name wildcard', () => {
    const names = adjacentFloorNames(topology, { stop: 8, kind: 'connector' });
    expect([...names].sort()).toEqual(['village-track-channel-8', 'village-track-connector-8-7', 'village-track-carrier-7'].sort());
    expect(names.has('village-track-channel-6')).toBe(false);
    expect(adjacentFloorNames(topology, { stop: 7, kind: 'contact' }).has('village-track-connector-8-7')).toBe(true);
    expect(() => adjacentFloorNames({ ...topology, connectors: [{ from: 8, to: 6 }] }, { stop: 8, kind: 'connector' })).toThrow('adjacent');
    expect(() => adjacentFloorNames({ ...topology, connectors: [{ from: 8, to: 7 }, { from: 8, to: 7 }] }, { stop: 8, kind: 'connector' })).toThrow('one explicit');
  });
  it('rejects downstream hits on either side OUTSIDE the unchanged slab, outside the section, and nonadjacent hits inside both', () => {
    const names = adjacentFloorNames(topology, { stop: 8, kind: 'connector' });
    const center = new Vector3(), tangent = new Vector3(1, 0, 0), section = .6;
    for (const sign of [-1, 1]) {
      expect(intendedFloorHit('village-track-carrier-7', new Vector3(sign * (VILLAGE_RADIUS + .002), -.3, .1), center, tangent, names, section)).toBe(true);
      expect(intendedFloorHit('village-track-carrier-7', new Vector3(sign * (VILLAGE_RADIUS + .002 + 1e-6), -.3, .1), center, tangent, names, section)).toBe(false);
    }
    expect(intendedFloorHit('village-track-carrier-7', new Vector3(0, section + .002 + 1e-6, 0), center, tangent, names, section)).toBe(false);
    expect(intendedFloorHit('village-track-channel-6', new Vector3(0, -.3, .1), center, tangent, names, section)).toBe(false);
    expect(intendedFloorHit('village-stop-1-static-BoxGeometry-1', new Vector3(0, -.3, .1), center, tangent, names, section)).toBe(false);
  });
});


it('keeps the actual reduced-desktop connector8→7 wall foreign beyond the finite slab',()=>{
 const eye=new Vector3(...[-3.6, 19.041327413103865, 14.252977748617516]),target=new Vector3(...[-6.111558568326749, 5.261674367316415, -0.8965313578051483]);
 const triangle=[[-6.087500095367432, 5.58211612701416, -0.6000000238418579], [-6.043185234069824, 5.550454616546631, -0.5199999809265137], [-6.068749904632568, 5.593424320220947, -0.6000000238418579]].map(p=>new Vector3(p[0],p[1],p[2]));
 const hit=new Ray(eye,target.clone().sub(eye).normalize()).intersectTriangle(triangle[0]!,triangle[1]!,triangle[2]!,false,new Vector3());
 expect(hit).not.toBeNull();expect(hit!.distanceTo(eye)).toBeLessThan(target.distanceTo(eye)-.002);
 const center=new Vector3(...[-6.345702865179457, 5.418105465035841, -1]),tangent=new Vector3(...[0.8627595635191183, 0.5056144139127171, 0]);
 expect(Math.abs(hit!.clone().sub(center).dot(tangent))).toBeGreaterThan(VILLAGE_RADIUS+.002);
 expect(intendedFloorHit('village-track-connector-8-7',hit!,center,tangent,new Set(['village-track-connector-8-7']),0.5824946337563223)).toBe(false);
});

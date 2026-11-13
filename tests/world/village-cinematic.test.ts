import { describe, it, expect } from "vitest";
import { Matrix4, Quaternion, Vector3 } from "three";
import { VillageCinematic } from "../../src/world/village-cinematic";
import { VillageProgram } from "../../src/world/village-program";
import { VILLAGE_SCENE_PLANS } from "../../src/world/village-plans";
import { VILLAGE_SHAPES } from "../../src/world/village-shapes";
import {
  carrierContact,
  mechanismMatrix,
} from "../../src/view/machine-primitives";

describe("cinematic village films", () => {
  for (const scene of VILLAGE_SCENE_PLANS)
    describe(`chapter ${scene.chapter}`, () => {
      const route = new VillageCinematic(scene.plan);
      it("plays the complete authored route without claiming physical certification", () => {
        expect(route.playback.state).toBe("ready");
        expect(route.mode).toBe("cinematic");
        expect(() => route.requirePhysical()).toThrow(
          "not a physical simulation",
        );
        expect(route.contacts.map((c) => c.stop).sort((a, b) => a - b)).toEqual(
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        );
        expect(route.duration).toBeGreaterThan(10);
        expect(route.duration).toBeLessThan(150);
        const a = new Vector3(),
          b = new Vector3(),
          q = new Quaternion();
        route.sample(0, a);
        for (let t = 1 / 120; t < route.duration; t += 1 / 120) {
          route.sample(t, b);
          route.marbleOrientation(t, q);
          expect(b.toArray().every(Number.isFinite)).toBe(true);
          expect(Math.abs(q.length() - 1)).toBeLessThan(1e-10);
          expect(a.distanceTo(b), `teleport at ${t}`).toBeLessThan(0.09);
          a.copy(b);
        }
      });
      it("joins phases continuously and seeks in either direction identically", () => {
        const a = new Vector3(),
          b = new Vector3(),
          q = new Quaternion(),
          r = new Quaternion();
        for (const ph of route.phases) {
          route.sample(ph.end - 1e-8, a);
          route.sample(ph.end + 1e-8, b);
          expect(a.distanceTo(b), `phase ${ph.kind} at ${ph.end}`).toBeLessThan(
            1e-5,
          );
        }
        for (const t of [
          0,
          route.duration * 0.17,
          route.duration * 0.51,
          route.duration,
        ]) {
          route.sample(t, a);
          route.marbleOrientation(t, q);
          route.sample(route.duration - t, b);
          route.marbleOrientation(route.duration - t, r);
          route.sample(t, b);
          route.marbleOrientation(t, r);
          expect(b.toArray()).toEqual(a.toArray());
          expect(r.toArray()).toEqual(q.toArray());
        }
      });
      it("holds the marble on the same moving frame used to draw its carrier", () => {
        const a = new Vector3(),
          b = new Vector3(),
          M = new Matrix4();
        for (const ph of route.phases) {
          if (ph.kind !== "ride") continue;
          const c = ph.clip,
            s = c.station,
            local = carrierContact(s.mechanism),
            t = (ph.start + ph.end) / 2;
          route.sample(t, a);
          mechanismMatrix(s.mechanism, s.anchor, 0.5, M);
          b.set(c.held, local[1], local[2]).applyMatrix4(M);
          expect(a.distanceTo(b)).toBeLessThan(1e-12);
        }
      });
      it("keeps the established renderer shape contract", () => {
        const physical = new VillageProgram(scene.plan);
        for (const s of scene.plan.stations) {
          if (s.retention) {
            expect(route.retainedLayout(s.stop)).toBe(
              physical.retainedLayout(s.stop),
            );
            expect(route.retainedHeadRole(s.stop) ?? null).toBe(
              physical.retainedHeadRole(s.stop) ?? null,
            );
            expect(route.retainedForkOrigin(s.stop)).toBe(
              physical.retainedForkOrigin(s.stop),
            );
          }
          if (s.terminalCapture)
            expect(!!route.terminalPad(s.stop)).toBe(
              !!physical.terminalPad(s.stop),
            );
        }
        expect(VILLAGE_SHAPES[scene.chapter]).toBeDefined();
      });
    });
});

it('keeps the vertical loop brisk through its upside-down section',()=>{
 const scene=VILLAGE_SCENE_PLANS.find(s=>s.chapter===5)!,route=new VillageCinematic(scene.plan),loop=route.segments.find(p=>p.kind==='contact'&&scene.plan.stations.find(s=>s.stop===p.stop)!.mechanism.kind==='loop')!,p=new Vector3(),a=new Vector3(),b=new Vector3();let top=loop.start,height=-Infinity;
 for(let t=loop.start;t<=loop.end;t+=.01){route.sample(t,p);if(p.y>height){height=p.y;top=t;}}
 route.sample(top-.001,a);route.sample(top+.001,b);expect(a.distanceTo(b)/.002).toBeGreaterThan(6);expect(a.distanceTo(b)/.002).toBeLessThanOrEqual(6.51);
});

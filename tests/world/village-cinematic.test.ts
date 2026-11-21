import { describe, it, expect } from "vitest";
import { Matrix4, Quaternion, Vector3 } from "three";
import { VillageCinematic } from "../../src/world/village-cinematic";
import { VillageProgram } from "../../src/world/village-program";
import { VILLAGE_SCENE_PLANS } from "../../src/world/village-plans";
import { VILLAGE_SHAPES } from "../../src/world/village-shapes";
import { VillageTerminalPath } from "../../src/world/village-terminal";
import { cinematicMachine } from "./cinematic-world-fixture";
import {
  carrierContact,
  mechanismMatrix,
} from "../../src/view/machine-primitives";

it.each([0, 1])("chapter %i terminal only compresses after the marble reaches its brake", chapter => {
  const { machine, dispose } = cinematicMachine(chapter);
  try {
    const { route } = machine;
    if (!(route instanceof VillageCinematic)) throw new Error("Expected the shipped cinematic route");
    const station = route.authoredPlan.stations.find(station => station.terminalCapture)!;
    const path = new VillageTerminalPath(station);
    const contact = route.contacts.find(contact => contact.stop === station.stop)!;
    const roll = route.phases.find(phase => phase.kind === "roll" && phase.start <= contact.start && phase.end >= contact.end);
    if (!roll || roll.kind !== "roll") throw new Error("Expected a rolling terminal");
    const brakeTime = roll.start + roll.run.timeAt(roll.run.distanceAt(contact.start - roll.start) + path.startDistance);
    const damper = machine.root.getObjectByName(`village-${station.stop}-damper`)!;
    const expected = new Matrix4();
    path.headPose(path.startDistance, expected);
    for (let time = 0; time < brakeTime - 1 / 120; time += 1 / 120) {
      machine.apply(time);
      if (!damper.matrix.equals(expected)) expect(damper.matrix.toArray(), `brake time ${brakeTime}, marble time ${time}`).toEqual(expected.toArray());
    }
    machine.apply(contact.end);
    expect(damper.matrix.equals(expected)).toBe(false);
    const seated = damper.matrix.clone();
    machine.apply(0);
    expect(damper.matrix.equals(expected)).toBe(true);
    machine.apply(contact.end);
    expect(damper.matrix.equals(seated)).toBe(true);
  } finally {
    dispose();
  }
});

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
      it("rolls through seesaws, swinging bars, the clock gate and sliding carriages without stopping", () => {
        // Owner: only a lift may hold the marble. The first and last stops are the film's own rests.
        const a = new Vector3(),
          b = new Vector3();
        for (const s of scene.plan.stations) {
          const m = s.mechanism,
            passes =
              s.stop !== 9 &&
              s.stop !== 0 &&
              ((m.kind === "translating" &&
                m.travel[0] > 0 &&
                Math.abs(m.travel[1]) < 0.2) ||
                (!s.retention &&
                  (m.kind === "striker" ||
                    m.kind === "escapement" ||
                    ("pivot" in m && !m.dockingLift))));
          if (!passes) continue;
          const c = route.contacts.find((c) => c.stop === s.stop)!;
          let slowest = Infinity;
          for (let t = c.start; t < c.end - 1 / 120; t += 1 / 120) {
            route.sample(t, a);
            route.sample(t + 1 / 120, b);
            slowest = Math.min(slowest, a.distanceTo(b) * 120);
          }
          expect(slowest, `stop ${s.stop} ${m.kind}`).toBeGreaterThan(2);
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

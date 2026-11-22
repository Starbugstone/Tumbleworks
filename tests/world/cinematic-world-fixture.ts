import { Scene } from "three";
import { vi } from "vitest";
import { CAMPAIGN } from "../../src/campaign";
import { MarbleFactory } from "../../src/engine/marbles";
import type { Stage } from "../../src/engine/stage";
import * as progress from "../../src/progress";
import { VillageMachine } from "../../src/view/village-machine";
import { WorldScene } from "../../src/view/world-scene";
import { worldProgress } from "../../src/world/progression";
import { WORKSHOP_PROJECTS } from "../../src/world/workshop-projects";

/** Native route and envelopes from the normal construction, before unrelated coastal dressing. */
export function cinematicMachine(chapter: number) {
  const stage = {
    createScene: () => new Scene(),
    disposeScene: (scene: Scene) => scene.clear(),
  } as unknown as Stage;
  const scene = WorldScene.construct(stage, chapter, { motion: "cinematic" });
  const construct = VillageMachine.prototype.construction;
  let machine: VillageMachine | undefined;
  const capture = vi.spyOn(VillageMachine.prototype, "construction").mockImplementation(function* (this: VillageMachine) {
    yield* construct.call(this);
    machine = this;
  });
  const dispose = () => { scene.return(undefined as never); };
  try {
    while (!machine) {
      const step = scene.next();
      if (step.done) {
        step.value.dispose();
        throw new Error("Village construction did not build a machine");
      }
    }
    return { machine, dispose };
  } catch (error) {
    dispose();
    throw error;
  } finally {
    capture.mockRestore();
  }
}

/** Actual production scene/earned additions; no WebGL renderer or physical certificate. */
export function cinematicWorld(chapter: number, unbatched = false) {
  const ids = [
    ...CAMPAIGN.map((l) => l.id),
    ...WORKSHOP_PROJECTS.map((p) => p.id),
  ];
  const complete = vi.spyOn(progress, "completedLevels").mockReturnValue(ids);
  const batching = unbatched
    ? vi
        .spyOn(
          VillageMachine.prototype as unknown as {
            merge(g: import("three").Group): void;
          },
          "merge",
        )
        .mockImplementation(() => {})
    : undefined;
  let width = 375,
    height = 690;
  const stage = {
    createScene: () => new Scene(),
    disposeScene: (s: Scene) => s.clear(),
    draw: () => {},
    marbles: new MarbleFactory(),
    canvas: {
      get clientWidth() {
        return width;
      },
      get clientHeight() {
        return height;
      },
    },
    renderer: { setSize: () => {} },
    get rect() {
      return { left: 0, top: 0, width, height };
    },
  } as unknown as Stage;
  let world: WorldScene;
  try {
    world = new WorldScene(stage, chapter, { motion: "cinematic" });
    world.update(
      worldProgress(CAMPAIGN, new Set(ids)).chapters[chapter]!,
      false,
    );
  } finally {
    complete.mockRestore();
    batching?.mockRestore();
  }
  world.resize();
  return {
    world,
    machine: world.machine,
    resize: (w: number, h: number) => {
      width = w;
      height = h;
      world.resize();
    },
    dispose: () => world.dispose(),
  };
}

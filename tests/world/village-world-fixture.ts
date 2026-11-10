import { cooperate } from '../../src/view/cooperative';
import { Scene } from 'three';
import { vi } from 'vitest';
import { CAMPAIGN } from '../../src/campaign';
import { MarbleFactory, type MarbleEntity } from '../../src/engine/marbles';
import type { Stage } from '../../src/engine/stage';
import * as progress from '../../src/progress';
import { VillageMachine } from '../../src/view/village-machine';
import { WorldScene } from '../../src/view/world-scene';
import { worldProgress } from '../../src/world/progression';
import type{VillageProgram}from'../../src/world/village-program';
import type { VillagePlan } from '../../src/world/village-plan';
import { WORKSHOP_PROJECTS } from '../../src/world/workshop-projects';
import type { StaticProofBackend } from '../../src/view/static-proof-owner';
import { InlineProofBackend } from './static-proof-inline';
import { ManualScheduler } from './manual-scheduler';

interface WorldProbe { readonly machine: VillageMachine & {readonly route:VillageProgram}; readonly plan: VillagePlan; readonly marble: MarbleEntity | null }

/** Real Scene composition and reward installation; only the renderer is omitted in Node. */
/** TEST-ONLY proof path, never production worker/chunk/thread/cancel evidence. `inline` runs the SAME
 * pure proof in-process after construction and throws its rejection as the synchronous constructor
 * did; `held` submits nothing until the test activates, drains and flushes, so it can interleave. */
export function villageWorld(chapter: number, unbatched = false, proof: 'inline' | 'held' | StaticProofBackend = 'inline', construction:'sync'|'staged'='sync', diagnosticSteps = false) {
  const backend = typeof proof === 'string' ? new InlineProofBackend() : proof, scheduler = new ManualScheduler(0, 0, diagnosticSteps);
  const ids = [...CAMPAIGN.map(level => level.id), ...WORKSHOP_PROJECTS.map(project => project.id)];
  const completed = vi.spyOn(progress, 'completedLevels').mockReturnValue(ids);
  const prototype = VillageMachine.prototype as unknown as { merge(group: import('three').Group): void };
  const batching = unbatched ? vi.spyOn(prototype, 'merge').mockImplementation(() => undefined) : null;
  let width = 375, height = 690;
  // Stage owns WebGL resources in the browser. This harness preserves the real scene,
  // factory and projection contract while making no rendering/performance claim.
  const stage = {
    createScene: () => new Scene(), disposeScene: (scene: Scene) => scene.clear(), draw: () => undefined,
    marbles: new MarbleFactory(), canvas: { get clientWidth() { return width; }, get clientHeight() { return height; } },
    renderer: { setSize: () => undefined }, get rect() { return { left: 0, top: 0, width, height }; },
  } as unknown as Stage;
  let world: WorldScene;
  try {
    if(construction==='sync')world = new WorldScene(stage, chapter, { proof: backend, scheduler, sliceMs: 0 });else{const run=cooperate(WorldScene.construct(stage,chapter,{proof:backend,scheduler,sliceMs:0}),scheduler,0,()=>{});scheduler.drain();if(run.state!=='done')throw run.error;world=run.result!;}
    world.update(worldProgress(CAMPAIGN, new Set(ids)).chapters[chapter]!, false);
  } finally { completed.mockRestore(); batching?.mockRestore(); }
  const probe = world as unknown as WorldProbe;
  if (!(probe.machine instanceof VillageMachine)) { world.dispose(); throw new Error('Village guards require the new integrated VillageMachine, never legacy WorldRube'); }
  if (proof === 'inline') {
    world.activateProof(); scheduler.drain(); (backend as InlineProofBackend).flush(); scheduler.drain();
    const status = probe.machine.staticSupportInspection()?.proof;
    if (status?.state === 'failed') { world.dispose(); throw new Error(status.detail); }
  }
  world.resize();
  return { world, probe, proof: backend, scheduler, resize: (nextWidth: number, nextHeight: number) => { width = nextWidth; height = nextHeight; world.resize(); },
    dispose: () => world.dispose() };
}

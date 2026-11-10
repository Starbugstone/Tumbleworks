import type { Stage } from '../../src/engine/stage';
import { WorldScene } from '../../src/view/world-scene';
import { WorldFilm } from '../../src/view/world-film';

// Shipping scene mode, without a browser renderer or research proof backend.
export class TestWorldScene extends WorldScene {
  constructor(stage: Stage, chapter: number) {
    super(stage, chapter, { motion: 'cinematic' });
  }
}

export class TestWorldFilm extends WorldFilm {
  constructor(stage: Stage, chapter: number, current?: WorldScene) {
    super(stage, chapter, current, undefined, { motion: 'cinematic' });
    if (!this.begin()) throw new Error('Cinematic fixture failed to start');
  }
}

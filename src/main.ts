import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import Phaser from 'phaser';
import { GameScene } from './game/GameScene';
import { GAME_HEIGHT, GAME_WIDTH } from './game/layout';

async function boot(): Promise<void> {
  // Phaser draws text to a canvas, so the font has to be loaded before the first scene.
  await Promise.all([document.fonts.load('500 40px Fredoka'), document.fonts.load('600 40px Fredoka')]);

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#f4e6cf',
    antialias: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 2 },
    scene: [GameScene],
  });

  if (import.meta.env.DEV) {
    // Browser tests and capture scripts read state and find tap targets through this.
    Object.assign(window, { tumbleworks: { game, scene: () => game.scene.getScene('game') as GameScene } });
  }
}

void boot();

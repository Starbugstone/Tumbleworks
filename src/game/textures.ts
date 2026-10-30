import type Phaser from 'phaser';
import type { Color } from '../sim/types';
import { BOX, COLORS, LOGICAL_HEIGHT, LOGICAL_WIDTH, RENDER_SCALE, TRACK, TRAY, TRAY_SLOTS } from './layout';
import { trackPoint } from './track';

const ALL_COLORS: readonly Color[] = ['red', 'blue', 'green', 'yellow'];
export const MARBLE_TEXTURE_SIZE = 128;

type Ctx = CanvasRenderingContext2D;

function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: Ctx) => void,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, Math.ceil(width), Math.ceil(height));
  if (!texture) throw new Error(`Could not create texture ${key}`);
  draw(texture.getContext());
  texture.refresh();
}

function rounded(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Centred on (0, 0), radius r. Each colour has its own shape so the game never relies on hue alone. */
function symbolPath(ctx: Ctx, color: Color, r: number): void {
  ctx.beginPath();
  if (color === 'red') {
    ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    ctx.moveTo(r * 0.44, 0);
    ctx.arc(0, 0, r * 0.44, 0, Math.PI * 2, true);
  } else if (color === 'blue') {
    ctx.moveTo(0, -r * 1.1);
    ctx.lineTo(r * 0.92, 0);
    ctx.lineTo(0, r * 1.1);
    ctx.lineTo(-r * 0.92, 0);
    ctx.closePath();
  } else if (color === 'green') {
    ctx.moveTo(0, -r * 1.05);
    ctx.lineTo(r * 1.05, r * 0.8);
    ctx.lineTo(-r * 1.05, r * 0.8);
    ctx.closePath();
  } else {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? r * 1.15 : r * 0.5;
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.closePath();
  }
}

function drawMarble(ctx: Ctx, color: Color): void {
  const size = MARBLE_TEXTURE_SIZE;
  const c = size / 2;
  const r = c - 2;
  const palette = COLORS[color];

  const body = ctx.createRadialGradient(c - r * 0.35, c - r * 0.42, r * 0.08, c, c, r);
  body.addColorStop(0, palette.light);
  body.addColorStop(0.5, palette.base);
  body.addColorStop(0.84, palette.base);
  body.addColorStop(1, palette.dark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();

  // Light passing through the glass pools on the side away from the highlight.
  const glow = ctx.createRadialGradient(c + r * 0.42, c + r * 0.5, 0, c + r * 0.42, c + r * 0.5, r * 0.62);
  glow.addColorStop(0, 'rgba(255,255,255,0.42)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(c, c + r * 0.04);
  symbolPath(ctx, color, r * 0.36);
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fill('evenodd');
  ctx.restore();

  const highlight = ctx.createRadialGradient(c - r * 0.4, c - r * 0.5, 0, c - r * 0.4, c - r * 0.5, r * 0.34);
  highlight.addColorStop(0, 'rgba(255,255,255,0.98)');
  highlight.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  highlight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = highlight;
  ctx.beginPath();
  ctx.ellipse(c - r * 0.4, c - r * 0.5, r * 0.34, r * 0.25, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrack(ctx: Ctx): void {
  const scale = RENDER_SCALE;
  ctx.scale(scale, scale);
  const { cx, cy, straightHalf: s, radius: r, bandHalf: band } = TRACK;
  const stadium = (radius: number): void => {
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - radius);
    ctx.lineTo(cx + s, cy - radius);
    ctx.arc(cx + s, cy, radius, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(cx - s, cy + radius);
    ctx.arc(cx - s, cy, radius, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
  };

  // Machine body, with a soft shadow on the tabletop.
  ctx.save();
  ctx.shadowColor = 'rgba(92, 62, 28, 0.38)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 16;
  stadium(r + band + 12);
  ctx.fillStyle = '#fffaf0';
  ctx.fill();
  ctx.restore();

  const shell = ctx.createLinearGradient(0, cy - r - band, 0, cy + r + band);
  shell.addColorStop(0, '#ffffff');
  shell.addColorStop(1, '#ecdcc2');
  stadium(r + band + 12);
  ctx.fillStyle = shell;
  ctx.fill();

  // Rubber band.
  const rubber = ctx.createLinearGradient(0, cy - r - band, 0, cy + r + band);
  rubber.addColorStop(0, '#3b4069');
  rubber.addColorStop(1, '#2a2d4f');
  stadium(r + band);
  ctx.fillStyle = rubber;
  ctx.fill();

  // Recessed inner deck that holds the gauge.
  stadium(r - band);
  ctx.fillStyle = '#ecdcc2';
  ctx.fill();
  ctx.save();
  stadium(r - band);
  ctx.clip();
  ctx.shadowColor = 'rgba(70, 50, 30, 0.45)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#ecdcc2';
  stadium(r - band + 5);
  ctx.stroke();
  ctx.restore();
  stadium(r - band - 6);
  ctx.fillStyle = '#fbf2e2';
  ctx.fill();

  // Screws on the shell.
  for (let i = 0; i < 8; i++) {
    const p = trackPoint((i + 0.5) / 8);
    const nx = Math.sin(p.angle);
    const ny = -Math.cos(p.angle);
    const x = p.x + nx * (band + 7);
    const y = p.y + ny * (band + 7);
    ctx.fillStyle = '#c9b597';
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTray(ctx: Ctx, color: Color): void {
  const s = 2;
  ctx.scale(s, s);
  const m = 10;
  const w = TRAY.width;
  const h = TRAY.height;
  const palette = COLORS[color];
  ctx.save();
  ctx.shadowColor = 'rgba(92, 62, 28, 0.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 7;
  rounded(ctx, m, m, w, h, 28);
  ctx.fillStyle = palette.dark;
  ctx.fill();
  ctx.restore();

  const fill = ctx.createLinearGradient(0, m, 0, m + h);
  fill.addColorStop(0, palette.light);
  fill.addColorStop(1, palette.base);
  rounded(ctx, m, m, w, h - 6, 28);
  ctx.fillStyle = fill;
  ctx.fill();

  rounded(ctx, m + 8, m + 7, w - 16, h - 22, 21);
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fill();

  for (const slot of TRAY_SLOTS) {
    ctx.fillStyle = 'rgba(52, 40, 50, 0.3)';
    ctx.beginPath();
    ctx.arc(m + w / 2 + slot.x, m + h / 2 + slot.y - 2, 24, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBox(ctx: Ctx, color: Color): void {
  const s = 2;
  ctx.scale(s, s);
  const m = 12;
  const w = BOX.width;
  const h = BOX.height;
  const palette = COLORS[color];
  ctx.save();
  ctx.shadowColor = 'rgba(92, 62, 28, 0.42)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;
  rounded(ctx, m, m, w, h, 26);
  ctx.fillStyle = palette.dark;
  ctx.fill();
  ctx.restore();

  const fill = ctx.createLinearGradient(0, m, 0, m + h);
  fill.addColorStop(0, palette.light);
  fill.addColorStop(0.5, palette.base);
  fill.addColorStop(1, palette.base);
  rounded(ctx, m, m, w, h - 8, 26);
  ctx.fillStyle = fill;
  ctx.fill();

  for (let i = -1; i <= 1; i++) {
    const x = m + w / 2 + i * BOX.slotSpacing;
    const y = m + h / 2 - 4;
    ctx.fillStyle = 'rgba(30, 20, 40, 0.42)';
    ctx.beginPath();
    ctx.arc(x, y, 33, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    symbolPath(ctx, color, 13);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fill('evenodd');
    ctx.restore();
  }
}

function drawMiniBox(ctx: Ctx, color: Color): void {
  const s = 2;
  ctx.scale(s, s);
  const m = 6;
  const size = 64;
  const palette = COLORS[color];
  ctx.save();
  ctx.shadowColor = 'rgba(92, 62, 28, 0.38)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  rounded(ctx, m, m, size, size, 16);
  ctx.fillStyle = palette.dark;
  ctx.fill();
  ctx.restore();
  const fill = ctx.createLinearGradient(0, m, 0, m + size);
  fill.addColorStop(0, palette.light);
  fill.addColorStop(0.6, palette.base);
  rounded(ctx, m, m, size, size - 5, 16);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.translate(m + size / 2, m + size / 2 - 2);
  symbolPath(ctx, color, 15);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill('evenodd');
  ctx.restore();
}

export function createTextures(scene: Phaser.Scene): void {
  for (const color of ALL_COLORS) {
    canvasTexture(scene, `marble-${color}`, MARBLE_TEXTURE_SIZE, MARBLE_TEXTURE_SIZE, (ctx) => drawMarble(ctx, color));
    canvasTexture(scene, `tray-${color}`, (TRAY.width + 20) * 2, (TRAY.height + 28) * 2, (ctx) => drawTray(ctx, color));
    canvasTexture(scene, `box-${color}`, (BOX.width + 24) * 2, (BOX.height + 32) * 2, (ctx) => drawBox(ctx, color));
    canvasTexture(scene, `mini-${color}`, 76 * 2, 80 * 2, (ctx) => drawMiniBox(ctx, color));
  }

  canvasTexture(scene, 'track', LOGICAL_WIDTH * RENDER_SCALE, LOGICAL_HEIGHT * RENDER_SCALE, drawTrack);

  canvasTexture(scene, 'shadow', 96, 96, (ctx) => {
    const gradient = ctx.createRadialGradient(48, 48, 6, 48, 48, 46);
    gradient.addColorStop(0, 'rgba(20, 16, 40, 0.5)');
    gradient.addColorStop(0.6, 'rgba(20, 16, 40, 0.22)');
    gradient.addColorStop(1, 'rgba(20, 16, 40, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 96);
  });

  // Points along +x, which is the direction of travel at rotation 0.
  canvasTexture(scene, 'chevron', 48, 72, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(10, 9);
    ctx.lineTo(36, 36);
    ctx.lineTo(10, 63);
    ctx.stroke();
  });

  createIcons(scene);

  canvasTexture(scene, 'dots', 44, 44, (ctx) => {
    ctx.fillStyle = 'rgba(160, 118, 66, 0.1)';
    ctx.beginPath();
    ctx.arc(11, 11, 3, 0, Math.PI * 2);
    ctx.arc(33, 33, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTexture(scene, 'pip', 40, 40, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(20, 20, 18, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTexture(scene, 'confetti', 20, 12, (ctx) => {
    rounded(ctx, 0, 0, 20, 12, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });

  canvasTexture(scene, 'spark', 48, 48, (ctx) => {
    const gradient = ctx.createRadialGradient(24, 24, 1, 24, 24, 24);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 48, 48);
  });

  // Funnel marbles pour through onto the belt.
  canvasTexture(scene, 'entry-gate', 110 * 2, 110 * 2, (ctx) => {
    ctx.scale(2, 2);
    ctx.save();
    ctx.shadowColor = 'rgba(40, 30, 30, 0.4)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(96, 8);
    ctx.lineTo(80, 98);
    ctx.quadraticCurveTo(55, 106, 30, 98);
    ctx.closePath();
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(30, 18);
    ctx.lineTo(80, 18);
    ctx.lineTo(70, 88);
    ctx.quadraticCurveTo(55, 93, 40, 88);
    ctx.closePath();
    ctx.fillStyle = '#3b4069';
    ctx.fill();
  });

  // Hood over the belt at the delivery point, with a lamp tinted to the active box.
  canvasTexture(scene, 'chute', 130 * 2, 170 * 2, (ctx) => {
    ctx.scale(2, 2);
    ctx.save();
    ctx.shadowColor = 'rgba(40, 30, 30, 0.42)';
    ctx.shadowBlur = 9;
    ctx.shadowOffsetY = 4;
    rounded(ctx, 25, 8, 80, 150, 24);
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.restore();
    rounded(ctx, 37, 40, 56, 108, 18);
    ctx.fillStyle = '#3b4069';
    ctx.fill();
  });

  canvasTexture(scene, 'lamp', 64, 64, (ctx) => {
    const gradient = ctx.createRadialGradient(24, 22, 2, 32, 32, 30);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, '#f0f0f0');
    gradient.addColorStop(1, '#a8a8a8');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTexture(scene, 'button', 320 * 2, 104 * 2, (ctx) => {
    ctx.scale(2, 2);
    ctx.save();
    ctx.shadowColor = 'rgba(92, 62, 28, 0.38)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 6;
    rounded(ctx, 10, 8, 300, 84, 30);
    ctx.fillStyle = '#d8c6a6';
    ctx.fill();
    ctx.restore();
    rounded(ctx, 10, 8, 300, 76, 30);
    ctx.fillStyle = '#fffdf8';
    ctx.fill();
  });

  canvasTexture(scene, 'button-primary', 380 * 2, 112 * 2, (ctx) => {
    ctx.scale(2, 2);
    ctx.save();
    ctx.shadowColor = 'rgba(92, 62, 28, 0.42)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 6;
    rounded(ctx, 10, 8, 360, 92, 34);
    ctx.fillStyle = '#b53a1c';
    ctx.fill();
    ctx.restore();
    const fill = ctx.createLinearGradient(0, 8, 0, 92);
    fill.addColorStop(0, '#ff9a62');
    fill.addColorStop(1, '#f25f33');
    rounded(ctx, 10, 8, 360, 84, 34);
    ctx.fillStyle = fill;
    ctx.fill();
  });

  canvasTexture(scene, 'chip', 72 * 2, 72 * 2, (ctx) => {
    ctx.scale(2, 2);
    ctx.save();
    ctx.shadowColor = 'rgba(92, 62, 28, 0.32)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(36, 34, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  canvasTexture(scene, 'card', 480 * 2, 310 * 2, (ctx) => {
    ctx.scale(2, 2);
    ctx.save();
    ctx.shadowColor = 'rgba(70, 50, 30, 0.42)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    rounded(ctx, 14, 12, 452, 280, 36);
    ctx.fillStyle = '#fffdf8';
    ctx.fill();
    ctx.restore();
  });

  canvasTexture(scene, 'arrow', 72 * 2, 88 * 2, (ctx) => {
    ctx.scale(2, 2);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.moveTo(24, 6);
    ctx.lineTo(48, 6);
    ctx.lineTo(48, 44);
    ctx.lineTo(66, 44);
    ctx.lineTo(36, 80);
    ctx.lineTo(6, 44);
    ctx.lineTo(24, 44);
    ctx.closePath();
    ctx.fillStyle = '#f25f33';
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  });
}

function createIcons(scene: Phaser.Scene): void {
  const stroke = (ctx: Ctx, width: number): void => {
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  canvasTexture(scene, 'icon-undo', 64, 64, (ctx) => {
    stroke(ctx, 7);
    ctx.beginPath();
    ctx.arc(34, 36, 18, -Math.PI * 0.9, Math.PI * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, 24);
    ctx.lineTo(16, 12);
    ctx.lineTo(23, 29);
    ctx.closePath();
    ctx.fill();
  });

  canvasTexture(scene, 'icon-restart', 64, 64, (ctx) => {
    stroke(ctx, 7);
    ctx.beginPath();
    ctx.arc(32, 34, 20, -Math.PI * 0.35, Math.PI * 1.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(52, 8);
    ctx.lineTo(53, 27);
    ctx.lineTo(35, 22);
    ctx.closePath();
    ctx.fill();
  });

  canvasTexture(scene, 'icon-check', 64, 64, (ctx) => {
    stroke(ctx, 10);
    ctx.beginPath();
    ctx.moveTo(13, 34);
    ctx.lineTo(27, 48);
    ctx.lineTo(52, 17);
    ctx.stroke();
  });

  const speaker = (ctx: Ctx): void => {
    stroke(ctx, 6);
    ctx.beginPath();
    ctx.moveTo(8, 25);
    ctx.lineTo(19, 25);
    ctx.lineTo(32, 13);
    ctx.lineTo(32, 51);
    ctx.lineTo(19, 39);
    ctx.lineTo(8, 39);
    ctx.closePath();
    ctx.fill();
  };
  canvasTexture(scene, 'icon-sound', 64, 64, (ctx) => {
    speaker(ctx);
    ctx.beginPath();
    ctx.arc(34, 32, 11, -0.8, 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(34, 32, 22, -0.8, 0.8);
    ctx.stroke();
  });
  canvasTexture(scene, 'icon-muted', 64, 64, (ctx) => {
    speaker(ctx);
    ctx.beginPath();
    ctx.moveTo(41, 24);
    ctx.lineTo(57, 40);
    ctx.moveTo(57, 24);
    ctx.lineTo(41, 40);
    ctx.stroke();
  });
}

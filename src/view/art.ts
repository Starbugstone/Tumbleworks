import * as THREE from 'three';
import type { Color } from '../sim/types';

export interface Palette {
  readonly base: string;
  readonly light: string;
  readonly dark: string;
  readonly hex: number;
}

export const COLORS: Record<Color, Palette> = {
  red: { base: '#e4332f', light: '#ff9b86', dark: '#7c0d18', hex: 0xe4332f },
  blue: { base: '#1f6fee', light: '#8fc8ff', dark: '#0a2f86', hex: 0x1f6fee },
  green: { base: '#16a650', light: '#93f0ac', dark: '#075a2b', hex: 0x16a650 },
  yellow: { base: '#f9b917', light: '#fff2a6', dark: '#a86a04', hex: 0xf9b917 },
};
export const COLOR_NAMES: Record<Color, string> = { red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow' };

type Ctx = CanvasRenderingContext2D;

function canvas(width: number, height: number, draw: (ctx: Ctx) => void): HTMLCanvasElement {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('2D canvas is unavailable');
  draw(ctx);
  return element;
}

function texture(element: HTMLCanvasElement): THREE.CanvasTexture {
  const result = new THREE.CanvasTexture(element);
  result.colorSpace = THREE.SRGBColorSpace;
  result.anisotropy = 4;
  return result;
}

/** A band that wanders around the marble, so spinning is easy to see. */
function ribbon(ctx: Ctx, width: number, _height: number, y: number, thickness: number, amplitude: number, waves: number, phase: number, style: string): void {
  ctx.fillStyle = style;
  ctx.beginPath();
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const w = Math.sin((i / steps) * Math.PI * 2 * waves + phase) * amplitude;
    const t = thickness * (0.55 + 0.45 * Math.sin((i / steps) * Math.PI * 2 * (waves + 1) + phase * 2));
    if (i === 0) ctx.moveTo(x, y + w - t);
    else ctx.lineTo(x, y + w - t);
  }
  for (let i = steps; i >= 0; i--) {
    const x = (i / steps) * width;
    const w = Math.sin((i / steps) * Math.PI * 2 * waves + phase) * amplitude;
    const t = thickness * (0.55 + 0.45 * Math.sin((i / steps) * Math.PI * 2 * (waves + 1) + phase * 2));
    ctx.lineTo(x, y + w + t);
  }
  ctx.closePath();
  ctx.fill();
}

export function marbleMaterial(color: Color): THREE.MeshPhysicalMaterial {
  const palette = COLORS[color];
  const map = texture(
    canvas(1024, 512, (ctx) => {
      const body = ctx.createLinearGradient(0, 0, 0, 512);
      body.addColorStop(0, palette.dark);
      body.addColorStop(0.3, palette.base);
      body.addColorStop(0.7, palette.base);
      body.addColorStop(1, palette.dark);
      ctx.fillStyle = body;
      ctx.fillRect(0, 0, 1024, 512);
      ribbon(ctx, 1024, 512, 130, 44, 58, 2, 0.4, palette.dark);
      ribbon(ctx, 1024, 512, 384, 40, 66, 3, 2.2, palette.dark);
      ribbon(ctx, 1024, 512, 250, 34, 78, 2, 1.4, palette.light);
      ribbon(ctx, 1024, 512, 256, 8, 92, 3, 4.1, 'rgba(255,255,255,0.8)');
    }),
  );
  return new THREE.MeshPhysicalMaterial({
    map,
    roughness: 0.05,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    ior: 1.55,
    specularIntensity: 1,
    envMapIntensity: 3.2,
  });
}

/** A clear glass shell. The colour comes from the twist inside and a tint in the glass. */
export function glassMaterial(color: Color): THREE.MeshPhysicalMaterial {
  const palette = COLORS[color];
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.light).lerp(new THREE.Color(0xffffff), 0.45),
    transmission: 1,
    thickness: 0.7,
    ior: 1.5,
    roughness: 0.03,
    metalness: 0,
    attenuationColor: new THREE.Color(palette.base),
    attenuationDistance: 0.85,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 3,
  });
}

export function twistMaterial(color: Color): THREE.MeshStandardMaterial {
  const palette = COLORS[color];
  return new THREE.MeshStandardMaterial({
    color: palette.hex,
    emissive: palette.hex,
    emissiveIntensity: 0.28,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
}

/** Three twisted vanes through the marble's middle, like a cat's-eye marble. */
export function twistGeometry(radius: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const steps = 14;
  const vanes = 3;
  const turns = 2.1;
  for (let vane = 0; vane < vanes; vane++) {
    const start = (vane / vanes) * Math.PI * 2;
    const point = (i: number, out: number): number[] => {
      const y = -1 + (2 * i) / steps;
      const reach = Math.sqrt(Math.max(1 - y * y, 0)) * out;
      const angle = start + y * turns;
      return [Math.cos(angle) * reach * radius, y * radius, Math.sin(angle) * reach * radius];
    };
    for (let i = 0; i < steps; i++) {
      const a = point(i, 0);
      const b = point(i, 1);
      const c = point(i + 1, 1);
      const d = point(i + 1, 0);
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function woodTexture(): THREE.CanvasTexture {
  const result = texture(
    canvas(1024, 1024, (ctx) => {
      ctx.fillStyle = '#a06c3c';
      ctx.fillRect(0, 0, 1024, 1024);
      // Planks, then grain running along them. A fixed pattern, so every run looks the same.
      let seed = 7;
      const random = (): number => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let plank = 0; plank < 4; plank++) {
        const y = plank * 256;
        const tone = 0.95 + random() * 0.1;
        ctx.fillStyle = `rgba(${Math.floor(150 * tone)}, ${Math.floor(98 * tone)}, ${Math.floor(54 * tone)}, 1)`;
        ctx.fillRect(0, y, 1024, 256);
        for (let i = 0; i < 70; i++) {
          const gy = y + random() * 256;
          ctx.strokeStyle = `rgba(${random() > 0.5 ? '70, 38, 14' : '226, 176, 118'}, ${0.02 + random() * 0.06})`;
          ctx.lineWidth = 0.6 + random() * 2.4;
          ctx.beginPath();
          ctx.moveTo(0, gy);
          const bend = (random() - 0.5) * 26;
          ctx.bezierCurveTo(340, gy + bend, 680, gy - bend, 1024, gy);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(52, 28, 10, 0.22)';
        ctx.fillRect(0, y, 1024, 2);
      }
    }),
  );
  result.wrapS = THREE.RepeatWrapping;
  result.wrapT = THREE.RepeatWrapping;
  result.repeat.set(3, 3);
  return result;
}

/** Each colour has its own shape, so the machine never relies on hue alone. */
export function drawSymbol(ctx: Ctx, color: Color, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
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
  ctx.fill('evenodd');
  ctx.restore();
}

export function symbolTexture(color: Color): THREE.CanvasTexture {
  return texture(
    canvas(128, 128, (ctx) => {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      drawSymbol(ctx, color, 64, 66, 46);
    }),
  );
}

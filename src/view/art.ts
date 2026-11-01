import * as THREE from 'three';
import type { Color } from '../sim/types';
import { colorName, patternName } from '../i18n';

export interface Palette {
  readonly base: string;
  readonly light: string;
  readonly dark: string;
  readonly hex: number;
}

/**
 * Chosen so that no pair relies on hue alone: yellow is the brightest colour by far, green is a deep
 * teal, red and blue sit between. Red-green and yellow-green confusions still leave a luminance gap.
 * Orange, the late fifth colour, sits halfway up in luminance (about 0.40 against 0.15–0.21 for the
 * dark three and 0.73 for yellow), so it never shares a brightness band with a neighbour on its hue line.
 */
export const COLORS: Record<Color, Palette> = {
  red: { base: '#e4332f', light: '#ff9b86', dark: '#7c0d18', hex: 0xe4332f },
  blue: { base: '#2a63e8', light: '#9cc6ff', dark: '#0c2c82', hex: 0x2a63e8 },
  green: { base: '#0b8f7a', light: '#7fe0cc', dark: '#044a40', hex: 0x0b8f7a },
  yellow: { base: '#ffdc52', light: '#fff8c8', dark: '#b58a05', hex: 0xffdc52 },
  orange: { base: '#ff8a1c', light: '#ffc48a', dark: '#8a3f00', hex: 0xff8a1c },
};
export const marbleName = (color: Color): string => `${patternName(color)} (${colorName(color)})`;

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

/** The shared marble entity: a plain glossy sphere in its natural colour. */
export function marbleMaterial(color: Color): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color: COLORS[color].hex, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.3 });
}

/** A clear glass shell. The colour comes from the twist inside and a tint in the glass. */
export function glassMaterial(color: Color): THREE.MeshPhysicalMaterial {
  const palette = COLORS[color];
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.light).lerp(new THREE.Color(0xffffff), 0.7),
    transmission: 1,
    thickness: 0.28,
    ior: 1.35,
    roughness: 0.02,
    metalness: 0,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 2.4,
  });
}

export function twistMaterial(color: Color): THREE.MeshStandardMaterial {
  const palette = COLORS[color];
  return new THREE.MeshStandardMaterial({
    color: palette.hex,
    emissive: palette.hex,
    emissiveIntensity: 0.55,
    roughness: 0.35,
    side: THREE.DoubleSide,
  });
}

/** Three twisted vanes through the marble's middle, like a cat's-eye marble. */
export function twistGeometry(radius: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const steps = 14;
  const vanes = 4;
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
  } else if (color === 'yellow') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 === 0 ? r * 1.15 : r * 0.5;
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.closePath();
  } else {
    // A bold cross: four arms read at every size and never look like the ring, diamond, triangle or star.
    const arm = r * 0.4;
    const reach = r * 1.08;
    ctx.moveTo(-arm, -reach); ctx.lineTo(arm, -reach); ctx.lineTo(arm, -arm); ctx.lineTo(reach, -arm);
    ctx.lineTo(reach, arm); ctx.lineTo(arm, arm); ctx.lineTo(arm, reach); ctx.lineTo(-arm, reach);
    ctx.lineTo(-arm, arm); ctx.lineTo(-reach, arm); ctx.lineTo(-reach, -arm); ctx.lineTo(-arm, -arm);
    ctx.closePath();
  }
  ctx.fill('evenodd');
  ctx.restore();
}

/** Printed on containers, with a light backing for contrast on every plastic color. */
export function containerSymbolTexture(color: Color): THREE.CanvasTexture {
  return texture(canvas(128, 128, (ctx) => {
    ctx.fillStyle = '#202335';
    ctx.beginPath(); ctx.arc(64, 64, 62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff9ee';
    ctx.beginPath(); ctx.arc(64, 64, 57, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#202335';
    drawSymbol(ctx, color, 64, 64, 39);
  }));
}

/** A plain glossy marble in its natural colour, for instanced crowds. Patterns live on the containers. */
export function crowdMaterial(color: Color): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color: COLORS[color].hex, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.3 });
}

/** A printed pattern badge for containers: readable on every plastic colour and in grayscale. */
export function decal(color: Color, size = 0.5): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: containerSymbolTexture(color), transparent: true, depthWrite: false, toneMapped: false }));
  mesh.renderOrder = 2;
  return mesh;
}

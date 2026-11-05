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
 * Chosen so that no pair relies on hue alone: yellow is the brightest chromatic colour, green is a deep
 * teal, red and blue sit between. Red-green and yellow-green confusions still leave a luminance gap.
 * Orange, the late fifth colour, sits halfway up in luminance (about 0.40 against 0.15–0.21 for the
 * dark three and 0.73 for yellow). White is a separate, lighter neutral; black sits below the dark three.
 */
export const COLORS: Record<Color, Palette> = {
  red: { base: '#e4332f', light: '#ff9b86', dark: '#7c0d18', hex: 0xe4332f },
  blue: { base: '#2a63e8', light: '#9cc6ff', dark: '#0c2c82', hex: 0x2a63e8 },
  green: { base: '#0b8f7a', light: '#7fe0cc', dark: '#044a40', hex: 0x0b8f7a },
  yellow: { base: '#ffdc52', light: '#fff8c8', dark: '#b58a05', hex: 0xffdc52 },
  orange: { base: '#ff8a1c', light: '#ffc48a', dark: '#8a3f00', hex: 0xff8a1c },
  black: { base: '#141821', light: '#606978', dark: '#06090f', hex: 0x141821 },
  white: { base: '#f3f5f0', light: '#fffefd', dark: '#b8c2c8', hex: 0xf3f5f0 },
};
/** Ink for a pattern printed directly on coloured plastic. */
export const cargoInk = (color: Color): string =>
  color === 'yellow' || color === 'orange' || color === 'white' ? '#202335' : '#fff9ee';

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
  } else if (color === 'orange') {
    // A bold cross: four arms read at every size and never look like the ring, diamond, triangle or star.
    const arm = r * 0.4;
    const reach = r * 1.08;
    ctx.moveTo(-arm, -reach); ctx.lineTo(arm, -reach); ctx.lineTo(arm, -arm); ctx.lineTo(reach, -arm);
    ctx.lineTo(reach, arm); ctx.lineTo(arm, arm); ctx.lineTo(arm, reach); ctx.lineTo(-arm, reach);
    ctx.lineTo(-arm, arm); ctx.lineTo(-reach, arm); ctx.lineTo(-reach, -arm); ctx.lineTo(-arm, -arm);
    ctx.closePath();
  } else if (color === 'black') {
    for (const x of [-r * 0.78, 0, r * 0.78]) {
      ctx.moveTo(x + r * 0.3, 0);
      ctx.arc(x, 0, r * 0.3, 0, Math.PI * 2);
    }
  } else if (color === 'white') {
    ctx.moveTo(0, r);
    ctx.bezierCurveTo(-r * 1.5, -r * 0.1, -r * 0.6, -r * 1.25, 0, -r * 0.45);
    ctx.bezierCurveTo(r * 0.6, -r * 1.25, r * 1.5, -r * 0.1, 0, r);
    ctx.closePath();
  } else {
    const missing: never = color;
    throw new Error(`Missing container pattern: ${missing}`);
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

/**
 * A printed pattern badge for containers: readable on every plastic colour and in grayscale. Pass a map
 * to share one material and texture per colour across a scene, instead of one of each per badge.
 */
export function decal(color: Color, size = 0.5, shared?: Map<Color, THREE.MeshBasicMaterial>): THREE.Mesh {
  let material = shared?.get(color);
  if (!material) {
    material = new THREE.MeshBasicMaterial({ map: containerSymbolTexture(color), transparent: true, depthWrite: false, toneMapped: false });
    shared?.set(color, material);
  }
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.renderOrder = 2;
  return mesh;
}

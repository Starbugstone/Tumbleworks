import * as THREE from 'three';
import themes from '../world/village-themes.json' with { type: 'json' };
import type { CounterFinish } from './board-counter';
import { worldLocation } from '../world/locations';
import { VILLAGE_SCENE_PLANS } from '../world/village-plans';
import { distanceToPolygon, pointInPolygon, terrainFieldHeight, terrainHeightRows, type VillageTerrainSpec } from '../world/village-terrain';

/** The worktop takes its finish from the current village, with that village's water or terrain beyond the edge. */
let village: number | null = null;

/** The village whose boards are being played, by chapter (`boardChapter` resolves it); null for a board that belongs to none. */
export function setBoardVillage(chapter: number | null): void { village = chapter; }
/** The chapter the board on screen was built for, for anything else that themes itself by village. */
export function boardVillage(): number | null { return village; }

/** Board units drawn per village unit: the landform is seen large and soft, as from close above. */
const SCALE = 1.5;
/** The square of ground, in board units, that is painted from the terrain; the camera never sees past it. */
const REACH = 56;
const GRID = 168;

const scratch = new THREE.Color();
const hsl = { h: 0, s: 0, l: 0 };
/** An authored village colour as board ground: its hue, a little more colour than the dusty original, and a lightness held in the middle. */
function ground(hex: number): [number, number, number] {
  scratch.setHex(hex, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
  scratch.setHSL(hsl.h, Math.min(1, hsl.s * 1.15 + 0.02), Math.min(0.47, Math.max(0.28, hsl.l * 0.84)), THREE.SRGBColorSpace);
  const out = scratch.getHex(THREE.SRGBColorSpace);
  return [out >> 16 & 255, out >> 8 & 255, out & 255];
}
type Rgb = readonly [number, number, number];
const mix = (a: Rgb, b: Rgb, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (from: number, to: number, value: number): number => { const t = Math.min(1, Math.max(0, (value - from) / (to - from))); return t * t * (3 - 2 * t); };
/** Smooth value noise in 0–1, for the broad patches a meadow has. */
function noise(x: number, z: number): number {
  const corner = (ix: number, iz: number): number => { const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453; return s - Math.floor(s); };
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return (corner(ix, iz) * (1 - ux) + corner(ix + 1, iz) * ux) * (1 - uz) + (corner(ix, iz + 1) * (1 - ux) + corner(ix + 1, iz + 1) * ux) * uz;
}

const painted = new Map<number, HTMLCanvasElement>();

/** One village's land seen from straight above: its coast, its water, its paths and beds, and its slopes in soft relief. */
function paintLand(spec: VillageTerrainSpec, focus: readonly [number, number], turf: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GRID;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The board backdrop needs a canvas');
  const image = ctx.createImageData(GRID, GRID);
  const { palette } = spec;
  // The village's theme colour is its turf; the rest of the land keeps the terrain's own palette.
  const grass = ground(turf), grassAlt = mix(grass, ground(palette.grassAlt), 0.6), rock = ground(palette.rock), shore = ground(palette.shore);
  const water = ground(palette.water), sea = mix(water, [20, 44, 58], 0.3);
  const holes = spec.features.filter((feature) => feature.kind === 'hole');
  const paints = spec.features.filter((feature) => feature.kind === 'paint').map((feature) => ({ polygon: feature.polygon, color: mix(ground(feature.color), grass, 0.55) }));
  const step = 0.4;
  const rowAt = terrainHeightRows(spec);
  for (let py = 0; py < GRID; py++) {
    const z = ((py + 0.5) / GRID - 0.5) * REACH / SCALE + focus[1];
    const row = rowAt(z), slopeRow = rowAt(z + step);
    for (let px = 0; px < GRID; px++) {
      // Canvas up is the back of the board, as in the village's own plan.
      const x = ((px + 0.5) / GRID - 0.5) * REACH / SCALE + focus[0];
      const coast = (pointInPolygon(spec.outline, x, z) ? 1 : -1) * distanceToPolygon(spec.outline, x, z);
      let color: [number, number, number];
      if (coast < -0.5) color = sea;
      else {
        const height = terrainFieldHeight(row, x, z);
        const slopeX = (terrainFieldHeight(row, x + step, z) - height) / step, slopeZ = (terrainFieldHeight(slopeRow, x, z + step) - height) / step;
        color = mix(grass, grassAlt, smooth(0.3, 0.7, noise(x * 0.32 + 7, z * 0.32 + 3) * 0.7 + noise(x * 0.9, z * 0.9) * 0.3));
        if (height < spec.water + 0.45) color = mix(color, shore, 0.7);
        for (const paint of paints) if (pointInPolygon(paint.polygon, x, z)) color = [...paint.color];
        color = mix(color, rock, smooth(0.5, 1.1, Math.hypot(slopeX, slopeZ)) * 0.8);
        // Lit from the back left like the board itself: slopes that face the light are a little lighter.
        const relief = 1 + Math.max(-0.13, Math.min(0.1, (slopeX * 0.55 + slopeZ * 0.6) * 0.11)) + Math.max(-0.03, Math.min(0.05, (height - spec.base) * 0.012));
        color = [color[0] * relief, color[1] * relief, color[2] * relief];
        for (const hole of holes) {
          const inside = pointInPolygon(hole.polygon, x, z), bank = distanceToPolygon(hole.polygon, x, z);
          if (inside) color = mix(mix(color, shore, 0.5), water, smooth(0, 0.6, bank));
        }
        // A pale strand, then the sea.
        color = mix(mix(sea, shore, 0.55), color, smooth(-0.5, 0.7, coast));
        if (coast < 0) color = mix(sea, color, smooth(-0.5, 0, coast));
      }
      const at = (py * GRID + px) * 4;
      image.data[at] = color[0]; image.data[at + 1] = color[1]; image.data[at + 2] = color[2]; image.data[at + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export interface BoardBackdrop {
  /** Water drifts and laps the hull; land lies still. */
  readonly kind: 'water' | 'land';
  readonly finish: CounterFinish;
  /** Paints the land into a square canvas that covers `span` board units, centred under the board. */
  readonly paint?: (ctx: CanvasRenderingContext2D, size: number, span: number) => void;
}

/** A village with no authored land yet: its theme colour as plain meadow. */
function paintMeadow(turf: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GRID;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The board backdrop needs a canvas');
  const image = ctx.createImageData(GRID, GRID);
  const grass = ground(turf), other: Rgb = [grass[0] * 0.9, grass[1] * 0.92, grass[2] * 0.9];
  for (let py = 0; py < GRID; py++) for (let px = 0; px < GRID; px++) {
    const x = px / GRID * REACH / SCALE, z = py / GRID * REACH / SCALE;
    const color = mix(grass, other, smooth(0.3, 0.7, noise(x * 0.32 + 7, z * 0.32 + 3) * 0.7 + noise(x * 0.9, z * 0.9) * 0.3));
    image.data.set([color[0], color[1], color[2], 255], (py * GRID + px) * 4);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** The backdrop for the board being built now. Harbour villages give water; every other kind gives its land. */
export function boardBackdrop(): BoardBackdrop {
  const finish = themes[(village ?? 0) % themes.length]!.counter as CounterFinish;
  if (village === null) return { kind: 'water', finish };
  const chapter = village, theme = worldLocation(chapter);
  if (theme.kind === 'harbour') return { kind: 'water', finish };
  const plan = VILLAGE_SCENE_PLANS.find((candidate) => candidate.chapter === chapter);
  return {
    kind: 'land', finish,
    paint: (ctx, size, span) => {
      let land = painted.get(chapter);
      if (!land) painted.set(chapter, land = plan ? paintLand(plan.cinematicTerrain ?? plan.terrain, theme.backdropFocus, theme.terrain) : paintMeadow(theme.terrain));
      const far = plan ? mix(ground(plan.terrain.palette.water), [20, 44, 58], 0.3) : mix(ground(theme.terrain), [20, 44, 58], 0.3);
      ctx.fillStyle = `rgb(${far.map(Math.round).join(',')})`;
      ctx.fillRect(0, 0, size, size);
      const side = REACH / span * size;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(land, (size - side) / 2, (size - side) / 2, side, side);
      // The ground falls away into shade toward the far edges, so the eye stays on the toy.
      const shade = ctx.createRadialGradient(size / 2, size / 2, 9 / span * size, size / 2, size / 2, 30 / span * size);
      shade.addColorStop(0, 'rgba(14,26,34,0)');
      shade.addColorStop(1, 'rgba(14,26,34,0.3)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, size, size);
    },
  };
}

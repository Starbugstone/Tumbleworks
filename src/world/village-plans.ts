/**
 * Author-owned extension of the compiler's `VillagePlan`: the landform, kit
 * dressing, Workshop site, reward slots and wider-world miniature of each
 * registered village. Six explicit plans; a chapter without one is an error,
 * never a recycled layout.
 */
import type { VillagePlan, VillageVec3 } from './village-plan';
import type { WorkshopSite } from './workshop-building';
import type { VillageTerrainSpec } from './village-terrain';
import { LITTLE_HARBOUR } from './villages/little-harbour';
import { GLASSHOUSE_GARDENS } from './villages/glasshouse-gardens';
import { WILLOW_MILL } from './villages/willow-mill';
import { CLOCKMAKERS_HILL } from './villages/clockmakers-hill';
import { CLOUD_BRIDGE } from './villages/cloud-bridge';
import { HIGH_GLASSWORKS } from './villages/high-glassworks';

/** One kit template instance. Only uniform scale, so corrected proportions and surface gaps survive. */
export interface VillageSceneryPiece {
  readonly model: string;
  readonly position: VillageVec3;
  /** Rotation about y in radians. */
  readonly yaw: number;
  readonly scale: number;
}

/** Where an earned Atelier addition stands; `project` is the stable Workshop level ID. */
export interface VillageRewardSlot {
  readonly project: string;
  readonly position: VillageVec3;
  readonly yaw: number;
}

/** How each earned stop's construction arrives: lifted from the ground, lowered from above or swung in. */
export type VillageConstruction = 'rise' | 'drop' | 'swing';

export interface VillageScenePlan {
  readonly chapter: number;
  readonly plan: VillagePlan;
  readonly construction: VillageConstruction;
  readonly terrain: VillageTerrainSpec;
  /** Houses, trees, warehouses, boats: fixed dressing baked with the terrain. */
  readonly scenery: readonly VillageSceneryPiece[];
  readonly workshop: WorkshopSite;
  readonly rewards: readonly VillageRewardSlot[];
  /** Pieces for the wider-world miniature; the overview draws them over the 8 × 8 terrain sample. */
  readonly overview: readonly VillageSceneryPiece[];
}

export const VILLAGE_SCENE_PLANS: readonly VillageScenePlan[] = [
  LITTLE_HARBOUR, GLASSHOUSE_GARDENS, WILLOW_MILL, CLOCKMAKERS_HILL, CLOUD_BRIDGE, HIGH_GLASSWORKS,
];

/** Explicit lookup by registered chapter index. There is no modulo or kind fallback. */
export function villageScenePlan(chapter: number): VillageScenePlan {
  const plan = VILLAGE_SCENE_PLANS.find(candidate => candidate.chapter === chapter);
  if (!plan) throw new Error(`Chapter ${chapter} has no authored village plan`);
  return plan;
}

export function hasVillageScenePlan(chapter: number): boolean {
  return VILLAGE_SCENE_PLANS.some(candidate => candidate.chapter === chapter);
}

/** Reward slots for one project, so the scene can install exactly the earned addition. */
export function villageRewardSlot(chapter: number, project: string): VillageRewardSlot {
  const slot = villageScenePlan(chapter).rewards.find(candidate => candidate.project === project);
  if (!slot) throw new Error(`Chapter ${chapter} has no reward slot for ${project}`);
  return slot;
}

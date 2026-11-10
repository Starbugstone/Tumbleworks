import type { RetainedLayout } from "./village-inventory";
export interface VillageShape {
  readonly layout?: RetainedLayout;
  readonly role?: "keyed-planar" | "captive-leaf" | null;
  readonly fork?: number;
  readonly planar?: boolean;
  readonly side?: 1 | -1;
  readonly sourceX?: number;
}
/** Geometry-only values captured from the working renderer; offline drift test owns updates. */
export const VILLAGE_SHAPES: Readonly<
  Record<number, Readonly<Record<number, VillageShape>>>
> = {
  "0": {
    "0": {
      planar: true,
    },
    "2": {
      sourceX: 2.01,
      layout: "keyed-split",
      role: "keyed-planar",
      fork: 0.12596940582259336,
    },
    "5": {
      layout: "keyed-split",
      role: "keyed-planar",
      fork: 0.11313721891508571,
    },
    "9": {
      layout: "rigid-gate",
      role: null,
      fork: 0.09000000000000002,
    },
  },
  "1": {
    "0": {
      planar: true,
    },
    "1": {
      layout: "keyed-prismatic",
      role: "captive-leaf",
      fork: 0.12480394741830231,
    },
    "5": {
      layout: "keyed-prismatic",
      role: "captive-leaf",
      fork: 0.13718954003240913,
    },
    "9": {
      layout: "rigid-gate",
      role: null,
      fork: 0.09000000000000002,
    },
  },
  "2": {
    "0": {
      layout: "rigid-gate",
      role: null,
      fork: 0.34,
    },
    "1": {
      layout: "rigid-gate",
      role: null,
      fork: 0.34,
    },
    "6": {
      layout: "rigid-gate",
      role: null,
      fork: 0.34,
    },
    "9": {
      layout: "rigid-gate",
      role: null,
      fork: 0.09000000000000002,
    },
  },
  "3": {
    "1": {
      layout: "rigid-gate",
      role: null,
      fork: 0.34,
    },
    "2": {
      // Open side of the turntable: its outgoing track occupies the rear bracket's space.
      side: 1,
      sourceX: 2.6,
      layout: "rigid-gate",
      role: null,
      fork: 0.34,
    },
    "6": {
      layout: "rigid-gate",
      role: null,
      fork: 0.34,
    },
  },
  "4": {"9":{sourceX:3}},
  "5": {},
};

/** Bump this when scoring semantics, heuristics, rules or simulator behavior changes. */
export const SCORER_VERSION = 'level-score-h1';
/** Role-aware Tube graphs distinguish spent cups and locked spare capacity. Classic scores are unchanged. */
export const TUBE_ROLE_SCORER_VERSION = 'tube-roles-h2';
export const STRONG_POLICY = {
  depths: [4, 6], lapse: 0.03, zeroLapse: 0,
  seeds: Array.from({ length: 60 }, (_, index) => index + 1),
  tubeSeeds: Array.from({ length: 1000 }, (_, index) => index + 1),
  nodeBudget: 100_000, oracleBudget: 40_000, graphBudget: 200_000,
  ticks: 60 * 240, actions: 120,
  timings: ['patient', 'burst2', 'burst3'],
  cyclePruning: 'forecast-path-and-previous-state',
  heuristic: 'observable-v1',
} as const;
export const SCORE_POLICY = {
  version: SCORER_VERSION,
  strong: STRONG_POLICY,
  legacy: {
    depths: [1, 2], lapse: 0.15, funnelGames: 60, loopGames: 200,
    machineGames: 60, tubeGames: 1000, tubeSeeds: [12345, 54321],
    machineSeeds: Array.from({ length: 200 }, (_, index) => index + 1),
    jitterSeeds: Array.from({ length: 20 }, (_, index) => index + 1),
    orderSeed: 4242, ticks: 60 * 240,
  },
} as const;
export const seeded = (seed: number): (() => number) => {
  let state = (seed * 7919 + 17) % 2147483646 + 1;
  return () => { state = (state * 16807) % 2147483647; return state / 2147483647; };
};

/** Explicit CLI sampling overrides are part of score validity too. */
export function scorePolicy(overrides: { funnelGames?: number; loopGames?: number; machineGames?: number } = {}) {
  const legacy = { ...SCORE_POLICY.legacy, ...overrides };
  return { ...SCORE_POLICY, legacy: { ...legacy, machineSeeds: Array.from({ length: Math.max(200, legacy.funnelGames, legacy.loopGames, legacy.machineGames) }, (_, index) => index + 1) } };
}

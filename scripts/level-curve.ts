import { createHash } from 'node:crypto';

/**
 * The difficulty curve as data and pure checks, so `tests/levelling/curve.test.ts` and the authors judge a level the same way.
 * The numbers and what they mean are in docs/levelling.md. Change a band there and here together, never as a one-off exception.
 */
export type Game = 'funnel' | 'loop' | 'tube';
export type Slot = 'tutorial' | 'lesson' | 'ordinary' | 'relief' | 'peak';
export type Band = readonly [number, number];

export interface Stretch {
  readonly first: number;
  readonly last: number;
  readonly ordinary: Band;
  readonly relief: Band | null;
  readonly peakMax: number | null;
  /** `FM <= F1 + gap` on Loop Sort. */
  readonly gap: number | null;
  /** Most that cheese or spam may win, as a share; relief and lessons get 0.10 more. Null means no ceiling. */
  readonly ceiling: number | null;
}

/** The last round of the campaign. */
export const LAST_ROUND = 120;

/**
 * Rounds 1-12 are the owner's accepted opening; 13-40 continue its feel; 41-120 climb to the ending. Bands from round 41 are
 * provisional until the strong planner's H is calibrated against the owner's play (docs/levelling.md).
 */
export const CURVE: readonly Stretch[] = [
  { first: 1, last: 3, ordinary: [0, 15], relief: null, peakMax: null, gap: null, ceiling: null },
  { first: 4, last: 6, ordinary: [30, 45], relief: [20, 30], peakMax: 52, gap: 25, ceiling: 0.85 },
  { first: 7, last: 12, ordinary: [40, 55], relief: [28, 40], peakMax: 62, gap: 25, ceiling: 0.8 },
  { first: 13, last: 20, ordinary: [44, 58], relief: [32, 44], peakMax: 64, gap: 25, ceiling: 0.78 },
  { first: 21, last: 30, ordinary: [50, 64], relief: [36, 48], peakMax: 70, gap: 28, ceiling: 0.74 },
  { first: 31, last: 40, ordinary: [56, 70], relief: [40, 52], peakMax: 76, gap: 30, ceiling: 0.7 },
  { first: 41, last: 60, ordinary: [60, 76], relief: [44, 58], peakMax: 84, gap: 30, ceiling: 0.65 },
  { first: 61, last: 80, ordinary: [66, 82], relief: [48, 62], peakMax: 90, gap: 30, ceiling: 0.6 },
  { first: 81, last: 100, ordinary: [70, 88], relief: [54, 68], peakMax: 96, gap: 30, ceiling: 0.55 },
  { first: 101, last: 110, ordinary: [74, 90], relief: [58, 72], peakMax: 98, gap: 30, ceiling: 0.52 },
  { first: 111, last: 118, ordinary: [76, 92], relief: [60, 74], peakMax: 99, gap: 30, ceiling: 0.5 },
  { first: 119, last: 120, ordinary: [80, 94], relief: [64, 76], peakMax: 100, gap: 30, ceiling: 0.5 },
];
/** From this round a lesson may not rise more than any other level, and Funnel Sort's ceiling binds spam as well as cheese. */
export const STRICT_FROM = 13;

export function stretchOf(round: number): Stretch {
  const stretch = CURVE.find((candidate) => round >= candidate.first && round <= candidate.last);
  if (!stretch) throw new Error(`No stretch for round ${round}`);
  return stretch;
}

/** Cheese and spam win ceiling, as a share. Null means no ceiling. */
export const winCeiling = (round: number): number | null => stretchOf(round).ceiling;

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));
const tempo = (f1: number, fast: number): number => clamp(0.25 * (fast - f1), -10, 12);
/** Win rates are shares; failures are percentages. */
export const funnelRating = (f1: number, burst2: number, burst3: number, cheese: number): number => f1 + tempo(f1, 100 * (1 - (burst2 + burst3 + cheese) / 3));
export const loopRating = (f1: number, fm: number): number => f1 + tempo(f1, fm);
/** Length alone is worth at most this much: the owner found long Tube Sort boards with no way to lose easy, however long. */
export const TUBE_LENGTH_CAP = 25;
export const tubeRating = (f1: number, moves: number): number => Math.max(f1, Math.min(TUBE_LENGTH_CAP, 2.5 * (moves - 4)));
export const multiTapFailure = (burst2: number, burst3: number): number => 100 * (1 - (burst2 + burst3) / 2);
/** Settled planners set F1 unless the same planners on the machine differ by more than this. */
export const MACHINE_OVERRIDE = 15;
export const chooseF1 = (settled: number, machine: number | null): number => machine !== null && Math.abs(machine - settled) > MACHINE_OVERRIDE ? machine : settled;

export const HINT_STATE_CAP: Readonly<Record<Game, number>> = { funnel: 100, loop: 75, tube: 12_000 };
export const TUBE_GRAPH_CAP = 40_000;
export const LOOP_MAX_SEGMENTS = 3;
export const LOOP_CAPACITY_MAX = 56;
export const OVAL_CAPACITY_MAX = 22;
export const MIN_RISK_POSITIONS = 2;

export const hashBoard = (board: object): string => {
  const { title: _title, solution: _solution, ...rules } = board as Record<string, unknown>;
  return createHash('sha256').update(JSON.stringify(rules)).digest('hex').slice(0, 16);
};

/** Everything measured about one board. Conveyor figures are absent on Tube Sort. */
export interface ScoreRow {
  readonly id: string;
  readonly game: Game;
  readonly hash: string;
  readonly A: number;
  /** The figure the rating uses, after the machine override. */
  readonly F1: number;
  readonly F1settled: number;
  /** The same planners on the real machine, when measured. */
  readonly F1machine: number | null;
  readonly FM: number;
  readonly S: number;
  readonly states: number;
  readonly risk: number;
  readonly lostShare: number;
  readonly silent: number;
  readonly hintStates: number;
  /** Win rates by player, with the games each was judged on. */
  readonly wins: Readonly<Record<string, { readonly win: number; readonly n: number; readonly recoveries?: number }>>;
  /** First six burst2 games, W or L; CI replays them so the table cannot drift from the code. */
  readonly probe?: string;
  readonly hasJam?: boolean;
  /** Which naive orders jam, of those the game has. */
  readonly naiveJams?: number;
  readonly naiveOrders?: number;
  /** Witness checks on the machine. */
  readonly witnessWins?: boolean;
  readonly jitter?: number;
  readonly shareBrisk?: number;
  readonly sharePatient?: number;
  readonly shareOrders?: number;
  readonly fastWitness?: boolean;
  readonly maxSegments?: number;
  readonly ringUnits?: number;
  readonly capacity?: number;
  readonly tight?: number;
  readonly graphStates?: number;
}

export interface Placement { readonly round: number; readonly game: Game; readonly slot: Slot; readonly row: ScoreRow; readonly signature?: string }

/** A level's structure: the same structure may not recur within five rounds of itself. */
export function signatureOf(board: { readonly supplies?: readonly (readonly { readonly count: number }[])[]; readonly docks?: readonly unknown[]; readonly trackShape?: string; readonly lanes?: readonly (readonly { readonly segments: readonly { readonly color: string }[] }[])[]; readonly loop?: readonly { readonly color: string; readonly count: number }[]; readonly tubes?: readonly (readonly string[])[]; readonly capacity?: number }): string {
  const sorted = (values: readonly number[]): string => [...values].sort((a, b) => b - a).join();
  const shape = board.trackShape ?? 'oval';
  if (board.supplies) {
    const trays = board.supplies.flat();
    const colors = new Set((trays as readonly { readonly color?: string }[]).map((tray) => tray.color)).size;
    return `c${colors} [${sorted(board.supplies.map((column) => column.length))}] sh${trays.filter((tray) => tray.count < 9).length} d${board.docks?.length} ${shape}`;
  }
  if (board.lanes) {
    const colors = new Set(board.lanes.flat().flatMap((truck) => truck.segments.map((segment) => segment.color))).size;
    const ring = (board.loop ?? []).reduce((sum, packet) => sum + packet.count, 0);
    const bucket = ring === 0 ? '0' : ring <= 12 ? '1-12' : ring <= 24 ? '13-24' : '25+';
    return `c${colors} [${sorted(board.lanes.map((queue) => queue.length))}] seg${Math.max(...board.lanes.flat().map((truck) => truck.segments.length))} ring${bucket} ${shape}`;
  }
  const tubes = board.tubes ?? [];
  const colors = new Set(tubes.flat()).size;
  return `c${colors} h${board.capacity} F${tubes.length - colors} spread${tubes.filter((tube) => tube.length).length}`;
}

const PEAK_PHASE: Readonly<Record<Game, number>> = { funnel: 4, loop: 0, tube: 2 };
const RELIEF_PHASE: Readonly<Record<Game, number>> = { funnel: 1, loop: 2, tube: 4 };
export const MAX_RISE = 20;
export const MAX_FALL = 25;
export const KEPT_LEVEL_LATE = 12;
export const KEPT_LEVEL_EARLY = 15;
export const FLAT_FALL = 3;

const upperOfLowerHalf = (band: Band): number => (band[0] + band[1]) / 2;
/** A lesson sits at relief or the bottom half of ordinary. */
export function bandFor(round: number, slot: Slot): Band | null {
  const stretch = stretchOf(round);
  if (slot === 'tutorial') return null;
  const low = stretch.relief?.[0] ?? stretch.ordinary[0];
  if (slot === 'relief') return stretch.relief ?? stretch.ordinary;
  if (slot === 'lesson') return stretch.first === 1 ? stretch.ordinary : [low, upperOfLowerHalf(stretch.ordinary)];
  if (slot === 'peak') return stretch.first === 1 ? stretch.ordinary : [stretch.ordinary[0], stretch.peakMax ?? 100];
  return stretch.ordinary;
}

/** The gates one level must pass whatever its neighbours are. Returns each failure in words. */
export function levelViolations(level: Placement): string[] {
  const { round, slot, row, game } = level;
  const out: string[] = [];
  const say = (text: string): void => { out.push(`${row.id} (round ${round}, ${slot}): ${text}`); };
  const band = bandFor(round, slot);
  if (band && (row.S < band[0] || row.S > band[1])) say(`S ${row.S.toFixed(1)} outside ${band[0]}-${band[1]}`);
  if (row.hintStates > HINT_STATE_CAP[game]) say(`opening hint visits ${row.hintStates} states, cap ${HINT_STATE_CAP[game]}`);
  if (slot === 'tutorial') return out;
  if (game === 'tube') {
    if ((row.graphStates ?? Infinity) > TUBE_GRAPH_CAP) say(`reachable graph ${row.graphStates} over ${TUBE_GRAPH_CAP}`);
    return out;
  }
  const ceiling = winCeiling(round);
  // Relief and lesson boards get ten points more room, because a lesson is meant to be won.
  const allowed = ceiling === null ? null : ceiling + (slot === 'relief' || slot === 'lesson' ? 0.1 : 0);
  const cheese = row.wins['cheese']?.win ?? 0;
  const spam = row.wins['spam']?.win ?? 0;
  const brisk = row.wins['brisk']?.win ?? 0;
  if (row.witnessWins !== true) say('witness does not win cleanly on the machine in both timings');
  if (round >= 4) {
    if ((row.jitter ?? 0) < 0.9) say(`witness wins ${row.jitter} under jitter, needs 0.9`);
    if ((row.shareBrisk ?? 0) < 0.6 || (row.sharePatient ?? 0) < 0.6) say(`rule-winning orders win ${row.shareBrisk}/${row.sharePatient} on the machine, needs 0.6 each`);
    if (!row.hasJam) say('no losing order');
    if (row.risk < MIN_RISK_POSITIONS) say(`only ${row.risk} risk positions, needs ${MIN_RISK_POSITIONS}`);
    if (row.fastWitness !== true) say('no recorded multi-tap win');
  }
  if (round >= 7 && round <= 30 && (row.naiveJams ?? 0) < 1) say('no naive order jams');
  if (round >= 31 && slot !== 'relief' && slot !== 'lesson' && (row.naiveJams ?? 0) < (row.naiveOrders ?? 0)) say('a naive order wins');
  if (game === 'funnel') {
    if (allowed !== null) {
      if (cheese > allowed + 1e-9) say(`cheese wins ${cheese.toFixed(2)}, ceiling ${allowed.toFixed(2)}: an auto win`);
      if (round >= STRICT_FROM && spam > allowed + 1e-9) say(`spam wins ${spam.toFixed(2)}, ceiling ${allowed.toFixed(2)}: an auto win`);
      if (100 * cheese > 100 - row.F1 + 40 + 1e-9) say(`cheese wins ${(100 * cheese).toFixed(0)} against planner ${(100 - row.F1).toFixed(0)} + 40: an auto win`);
    }
    if (round >= 4 && Math.max(cheese, spam) - brisk < 0.1 - 1e-9) say(`cheese or spam ${Math.max(cheese, spam).toFixed(2)} does not beat careful ${brisk.toFixed(2)} by 0.10`);
  } else {
    if (allowed !== null && spam > allowed + 1e-9) say(`spam wins ${spam.toFixed(2)}, ceiling ${allowed.toFixed(2)}: an auto win`);
    const gap = stretchOf(round).gap;
    if (gap !== null && row.FM > row.F1 + gap + 1e-9) say(`FM ${row.FM.toFixed(0)} above F1 ${row.F1.toFixed(0)} + ${gap}: fast tapping is fatal`);
    if ((row.maxSegments ?? 0) > LOOP_MAX_SEGMENTS) say(`a truck has ${row.maxSegments} segments`);
  }
  return out;
}

/** Whether a slot is where the level's five-round phrase says, from round 4 on. Takes one game's levels in round order. */
function rhythmViolations(levels: readonly Placement[]): string[] {
  const out: string[] = [];
  let owedPeak = false;
  levels.forEach((level, index) => {
    const { round, slot, game, row } = level;
    if (round < 4) return;
    const say = (text: string): void => { out.push(`${row.id} (round ${round}, ${slot}): ${text}`); };
    const phase = round % 5;
    const previous = levels[index - 1];
    if (phase === PEAK_PHASE[game]) {
      if (slot === 'lesson') owedPeak = true;
      else if (slot !== 'peak') say('this round is a peak in its phrase');
      else owedPeak = false;
    } else if (slot === 'peak') {
      if (!owedPeak) say('a peak here has no lesson displacing it');
      owedPeak = false;
    } else if (phase === RELIEF_PHASE[game]) {
      if (slot !== 'relief' && slot !== 'lesson') say('this round is relief in its phrase');
    } else if (slot === 'relief' && previous?.slot !== 'peak' && previous?.slot !== 'lesson') {
      say('relief belongs at its phrase position, after a peak or after a lesson');
    }
    if (owedPeak && phase !== PEAK_PHASE[game] && slot !== 'lesson' && slot !== 'peak') say('a displaced peak has to land before anything ordinary');
  });
  return out;
}

const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
const signatureWindow = 5;

/** Every step rule across a campaign. Rounds must be contiguous per game. */
export function curveViolations(levels: readonly Placement[]): string[] {
  const out = levels.flatMap(levelViolations);
  const games: Game[] = ['funnel', 'loop', 'tube'];
  const lines = new Map(games.map((game) => [game, levels.filter((level) => level.game === game).sort((a, b) => a.round - b.round)]));
  for (const line of lines.values()) {
    line.forEach((level, index) => {
      const previous = line[index - 1];
      if (!previous) return;
      const label = `${previous.row.id} to ${level.row.id}`;
      const rise = level.row.S - previous.row.S;
      // Early lessons may jump, because the opening teaches; from STRICT_FROM a lesson climbs like any other level.
      const excepted = (level.slot === 'lesson' && level.round < STRICT_FROM) || level.slot === 'tutorial' || previous.slot === 'tutorial';
      if (rise > MAX_RISE && !excepted) out.push(`${label}: rise ${rise.toFixed(1)} over ${MAX_RISE}`);
      if (rise < -MAX_FALL && previous.slot !== 'tutorial') out.push(`${label}: fall ${rise.toFixed(1)} under -${MAX_FALL}`);
      if (previous.slot === 'peak') {
        const top = upperOfLowerHalf(stretchOf(level.round).ordinary);
        if (level.slot === 'peak') out.push(`${label}: a peak directly after a peak`);
        if (level.row.S > top) out.push(`${label}: S ${level.row.S.toFixed(1)} after a peak is above the lower half of ordinary, ${top}`);
      }
    });
    out.push(...rhythmViolations(line));
    for (let index = 5; index < line.length; index++) {
      const now = mean(line.slice(index - 4, index + 1).filter((level) => level.slot !== 'tutorial').map((level) => level.row.S));
      const before = mean(line.slice(index - 5, index).filter((level) => level.slot !== 'tutorial').map((level) => level.row.S));
      if (now < before - FLAT_FALL) out.push(`${line[index]!.row.id}: five-round mean falls ${(before - now).toFixed(1)}, more than ${FLAT_FALL}`);
    }
    line.forEach((level, index) => {
      if (level.slot === 'tutorial' || !level.signature) return;
      for (const other of line.slice(Math.max(0, index - signatureWindow), index)) {
        if (other.slot !== 'tutorial' && other.signature === level.signature && level.game !== 'tube') out.push(`${other.row.id} and ${level.row.id}: same signature ${level.signature} within ${signatureWindow} rounds`);
      }
    });
  }
  const rounds = [...new Set(levels.map((level) => level.round))].sort((a, b) => a - b);
  for (const round of rounds) {
    const here = levels.filter((level) => level.round === round);
    if (here.length === 3 && here.every((level) => level.slot === 'peak')) out.push(`round ${round}: all three games peak`);
    if (round < 5) continue;
    const trailing = games.map((game) => {
      const recent = lines.get(game)!.filter((level) => level.round > round - 5 && level.round <= round);
      return recent.length === 5 ? mean(recent.map((level) => level.row.S)) : null;
    }).filter((value): value is number => value !== null);
    if (trailing.length < 2) continue;
    const limit = round >= 7 ? KEPT_LEVEL_LATE : KEPT_LEVEL_EARLY;
    const spread = Math.max(...trailing) - Math.min(...trailing);
    if (spread > limit) out.push(`round ${round}: trailing five-round means ${trailing.map((value) => value.toFixed(1)).join(', ')} differ by ${spread.toFixed(1)}, limit ${limit}`);
  }
  return out;
}

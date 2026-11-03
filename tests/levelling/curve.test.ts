import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../../src/campaign';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { BOARDS } from '../../src/sim/boards';
import { curveViolations, hashBoard, levelViolations, signatureOf, type Game, type Placement, type ScoreRow } from '../../scripts/level-curve';
import { SLOTS } from '../../scripts/level-slots';

const table = JSON.parse(readFileSync('tests/levelling/scores.json', 'utf8')) as ScoreRow[];
const scoreOf = new Map(table.map((row) => [row.id, row]));
const boards = new Map<string, object>([...BOARDS, ...LOOP_BOARDS, ...TUBE_BOARDS].map((board) => [board.id, board]));

/** A valid board to spoil: passes every gate at round 8. */
const valid: ScoreRow = {
  id: 'fixture', game: 'funnel', hash: '', A: 7, F1: 45, F1settled: 45, F1machine: 47, FM: 40, S: 45, states: 40, risk: 4, lostShare: 0.2, silent: 0, hintStates: 10,
  wins: { cheese: { win: 0.6, n: 60 }, spam: { win: 0.4, n: 60 }, brisk: { win: 0.2, n: 60 } },
  witnessWins: true, jitter: 1, shareBrisk: 1, sharePatient: 1, shareOrders: 12, fastWitness: true, hasJam: true, naiveJams: 1, naiveOrders: 3, capacity: 18,
};
const placed = (row: ScoreRow, round = 8, slot: Placement['slot'] = 'ordinary', game: Game = row.game): Placement => ({ round, game, slot, row });

describe('one level against its band and gates', () => {
  it('accepts a valid board', () => {
    expect(levelViolations(placed(valid))).toEqual([]);
  });
  it('rejects a board outside its band', () => {
    expect(levelViolations(placed({ ...valid, S: 12 })).join()).toMatch(/S 12\.0 outside 40-55/);
    expect(levelViolations(placed({ ...valid, S: 70 }, 8, 'peak')).join()).toMatch(/S 70\.0 outside 40-62/);
  });
  it('rejects an auto win, by the ceiling and against the planner', () => {
    const auto = { ...valid, wins: { ...valid.wins, cheese: { win: 1, n: 200 } } };
    expect(levelViolations(placed(auto)).join()).toMatch(/cheese wins 1\.00, ceiling 0\.80: an auto win/);
    const beatsPlanner = { ...valid, F1: 60, S: 35, wins: { ...valid.wins, cheese: { win: 0.85, n: 200 } } };
    expect(levelViolations(placed(beatsPlanner)).join()).toMatch(/against planner 40 \+ 40: an auto win/);
  });
  it('holds Funnel Sort spam to the same ceiling as cheese from round 13', () => {
    const spammy = { ...valid, wins: { ...valid.wins, spam: { win: 0.95, n: 200 } } };
    expect(levelViolations(placed(spammy, 8)).join()).not.toMatch(/spam wins/);
    expect(levelViolations(placed(spammy, 14)).join()).toMatch(/spam wins 0\.95, ceiling 0\.78: an auto win/);
  });
  it('rejects a board that does not reward fast play, never one for being hard to cheese alone', () => {
    const flat = { ...valid, wins: { cheese: { win: 0.2, n: 200 }, spam: { win: 0.2, n: 200 }, brisk: { win: 0.2, n: 200 } } };
    expect(levelViolations(placed(flat)).join()).toMatch(/does not beat careful/);
  });
  it('rejects a Loop Sort board whose fast tapping is fatal or that spam wins', () => {
    const loop: ScoreRow = { ...valid, game: 'loop', F1: 40, FM: 70, S: 45, maxSegments: 2, wins: { spam: { win: 0.2, n: 200 } } };
    expect(levelViolations(placed(loop)).join()).toMatch(/fast tapping is fatal/);
    expect(levelViolations(placed({ ...loop, FM: 60 }))).toEqual([]);
    expect(levelViolations(placed({ ...loop, FM: 60, wins: { spam: { win: 0.95, n: 200 } } })).join()).toMatch(/spam wins/);
    expect(levelViolations(placed({ ...loop, FM: 60, maxSegments: 4 })).join()).toMatch(/4 segments/);
  });
  it('reads the occasional-burst player for Loop Sort from round 13, the every-turn burst before', () => {
    const loop: ScoreRow = { ...valid, game: 'loop', F1: 40, FM: 100, S: 52, maxSegments: 3, wins: { spam: { win: 0.2, n: 200 }, mixed: { win: 0.5, n: 200 } } };
    expect(levelViolations(placed(loop, 8)).join()).toMatch(/fast tapping fail 100/);
    expect(levelViolations(placed(loop, 14))).toEqual([]);
    expect(levelViolations(placed({ ...loop, wins: { ...loop.wins, mixed: { win: 0.2, n: 200 } } }, 14)).join()).toMatch(/occasional bursts fail 80/);
  });
  it('rejects a board the planner cannot resolve on the machine', () => {
    expect(levelViolations(placed({ ...valid, witnessWins: false })).join()).toMatch(/witness/);
    expect(levelViolations(placed({ ...valid, jitter: 0.8 })).join()).toMatch(/jitter/);
    expect(levelViolations(placed({ ...valid, shareBrisk: 0.5 })).join()).toMatch(/rule-winning orders/);
    expect(levelViolations(placed({ ...valid, hasJam: false })).join()).toMatch(/no losing order/);
    expect(levelViolations(placed({ ...valid, risk: 1 })).join()).toMatch(/risk positions/);
    expect(levelViolations(placed({ ...valid, fastWitness: false })).join()).toMatch(/multi-tap/);
    expect(levelViolations(placed({ ...valid, naiveJams: 0 })).join()).toMatch(/naive/);
    expect(levelViolations(placed({ ...valid, hintStates: 101 })).join()).toMatch(/opening hint/);
  });
});

describe('the steps between levels', () => {
  const easy = (game: Game, round: number, S: number, slot: Placement['slot'] = 'ordinary', id = `${game}-${round}`): Placement => {
    const row: ScoreRow = game === 'tube'
      ? { id, game, hash: '', A: 8, F1: 0, F1settled: 0, F1machine: null, FM: 0, S, states: 10, risk: 0, lostShare: 0, silent: 0, hintStates: 10, wins: {}, graphStates: 10 }
      : game === 'loop' ? { ...valid, id, game, S, F1: S, FM: S, maxSegments: 2, wins: { spam: { win: 0.2, n: 60 } } } : { ...valid, id, S, F1: S };
    return { round, game, slot, row };
  };
  /** A valid twelve rounds, to spoil one step at a time. */
  const line = (game: Game): Placement[] => {
    const slots: Record<Game, readonly (readonly [number, Placement['slot']])[]> = {
      funnel: [[20, 'tutorial'], [8, 'ordinary'], [12, 'ordinary'], [28, 'lesson'], [42, 'peak'], [25, 'relief'], [35, 'lesson'], [45, 'ordinary'], [55, 'peak'], [40, 'lesson'], [35, 'relief'], [45, 'ordinary']],
      loop: [[0, 'tutorial'], [0, 'tutorial'], [10, 'ordinary'], [28, 'lesson'], [42, 'peak'], [35, 'ordinary'], [34, 'lesson'], [45, 'ordinary'], [48, 'ordinary'], [40, 'lesson'], [56, 'peak'], [35, 'relief']],
      tube: [[0, 'tutorial'], [5, 'ordinary'], [5, 'ordinary'], [24, 'relief'], [38, 'ordinary'], [30, 'lesson'], [48, 'peak'], [42, 'ordinary'], [38, 'lesson'], [38, 'lesson'], [35, 'relief'], [50, 'peak']],
    };
    return slots[game].map(([S, slot], index) => easy(game, index + 1, S, slot));
  };
  const all = (): Placement[] => [...line('funnel'), ...line('loop'), ...line('tube')];
  const swap = (levels: Placement[], id: string, S: number): Placement[] => levels.map((level) => (level.row.id === id ? { ...level, row: { ...level.row, S, F1: S, FM: S } } : level));

  it('accepts a valid stretch', () => {
    expect(curveViolations(all())).toEqual([]);
  });
  it('rejects a rise, a fall, a high level after a peak, a misplaced peak and games drifting apart', () => {
    expect(curveViolations(swap(all(), 'funnel-3', 15)).join()).toEqual('');
    expect(curveViolations(swap(all(), 'funnel-8', 65)).join()).toMatch(/rise 30\.0 over 20/);
    expect(curveViolations(swap(swap(all(), 'funnel-9', 60), 'funnel-10', 30)).join()).toMatch(/fall -30\.0 under -25/);
    expect(curveViolations(swap(all(), 'loop-11', 62)).join()).toMatch(/after a peak|fall/);
    expect(curveViolations(swap(all(), 'tube-8', 50)).join()).toMatch(/after a peak/);
    const misplaced = all().map((level) => (level.row.id === 'funnel-8' ? { ...level, slot: 'peak' as const } : level));
    expect(curveViolations(misplaced).join()).toMatch(/no lesson displacing it/);
    const apart = all().map((level) => (level.game === 'tube' ? { ...level, row: { ...level.row, S: 0 } } : level));
    expect(curveViolations(apart).join()).toMatch(/differ by/);
  });
  it('lets an opening lesson jump, but holds a lesson from round 13 to the rise rule', () => {
    expect(curveViolations([easy('tube', 9, 20), easy('tube', 10, 45, 'lesson')]).join()).not.toMatch(/rise/);
    expect(curveViolations([easy('tube', 24, 38, 'relief'), easy('tube', 25, 59, 'lesson')]).join()).toMatch(/rise 21\.0 over 20/);
  });
  it('rejects three games peaking in one round and a repeated structure', () => {
    const together = all().map((level) => (level.round === 9 ? { ...level, slot: 'peak' as const } : level));
    expect(curveViolations(together).join()).toMatch(/all three games peak/);
    const repeat = all().map((level) => (level.game === 'funnel' && (level.round === 7 || level.round === 8) ? { ...level, signature: 'same' } : level));
    expect(curveViolations(repeat).join()).toMatch(/same signature/);
  });
  it('catches the old spikes', () => {
    const spike = [easy('tube', 20, 0, 'ordinary', 'tube-20'), easy('tube', 21, 97, 'ordinary', 'tube-21'), easy('tube', 22, 1, 'ordinary', 'tube-22')];
    expect(curveViolations(spike).join()).toMatch(/rise 97/);
    const board8 = easy('funnel', 8, 28.5, 'ordinary', 'board-8');
    const board9 = easy('funnel', 9, 73.5, 'peak', 'board-9');
    expect(curveViolations([board8, board9]).join()).toMatch(/rise 45\.0/);
  });
});

describe('real boards against the gates', () => {
  const real = (id: string): ScoreRow => { const row = scoreOf.get(id); if (!row) throw new Error(id); return row; };
  it('rejects board-6 as an auto win, board-9 out of band, loop-12 as fatal to fast tapping, and accepts board-2 where it is placed', () => {
    expect(levelViolations(placed(real('board-6'), 8, 'ordinary')).join()).toMatch(/cheese wins 1\.00, ceiling 0\.80: an auto win/);
    expect(levelViolations(placed(real('board-9'), 9, 'peak')).join()).toMatch(/outside 40-62/);
    expect(levelViolations(placed(real('loop-12'), 9, 'ordinary')).join()).toMatch(/fast tapping is fatal/);
    expect(levelViolations(placed(real('board-2'), 11, 'relief'))).toEqual([]);
  });
});

describe('the score table', () => {
  it('has a row for every board, re-scored whenever the board changes', () => {
    for (const [id, board] of boards) {
      expect(scoreOf.get(id)?.hash, `${id} changed without a re-score: run scripts/level-score.ts score ${id}, then merge`).toBe(hashBoard(board));
    }
  });
  it('fails a changed board', () => {
    const board = BOARDS[0]!;
    expect(hashBoard({ ...board, beltCapacity: board.beltCapacity + 1 })).not.toBe(hashBoard(board));
    expect(hashBoard({ ...board, title: 'Renamed' })).toBe(hashBoard(board));
  });
});

describe('the campaign', () => {
  const kinds: Readonly<Record<string, Game>> = { conveyor: 'funnel', loop: 'loop', tube: 'tube' };
  const levels: Placement[] = ['conveyor', 'loop', 'tube'].flatMap((kind) => CAMPAIGN.filter((level) => level.kind === kind).map((level, index) => {
    const row = scoreOf.get(level.id);
    if (!row) throw new Error(`No score for ${level.id}`);
    const slot = SLOTS[level.id];
    if (!slot) throw new Error(`${level.id} has no slot in scripts/level-slots.ts`);
    return { round: index + 1, game: kinds[kind]!, slot, row, signature: signatureOf(boards.get(level.id)!) };
  }));
  it('meets every band and step rule', () => {
    expect(curveViolations(levels)).toEqual([]);
  });
});

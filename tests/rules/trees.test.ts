import { describe, expect, it } from 'vitest';
import { BOARD_1, BOARD_2 } from '../../src/sim/boards';
import { enumerate } from './drive';

describe('complete settled tap trees through MachineRules', () => {
  it('has exactly AAB winning and AB/BA jamming on board 1', () => {
    expect(enumerate(BOARD_1)).toEqual({ wins: ['AAB'], jams: ['AB', 'BA'] });
  });

  it('has exactly 13 wins and 13 jams on board 2, with a win from every opening', () => {
    const tree = enumerate(BOARD_2);
    expect(tree.wins).toEqual([
      'AABBC', 'AABCB', 'ABABC', 'ABACB', 'ABBAC', 'ABCAB', 'ACBAB',
      'BAABC', 'BAACB', 'BABAC', 'BACAB', 'BBAAC', 'CABAB',
    ]);
    expect(tree.jams).toEqual([
      'AAC', 'ABBC', 'ABCB', 'ACA', 'ACBB', 'BABC', 'BACB',
      'BBAC', 'BBCA', 'BC', 'CAA', 'CABB', 'CB',
    ]);
    expect(tree.wins).toHaveLength(13);
    expect(tree.jams).toHaveLength(13);
    for (const opening of ['A', 'B', 'C']) {
      expect(tree.wins.some((sequence) => sequence.startsWith(opening))).toBe(true);
    }
  });
});

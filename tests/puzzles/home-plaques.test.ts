import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../../src/campaign';
import { homePlaques } from '../../src/puzzles/home-plaques';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { TUBE_211 } from '../../src/puzzles/variety-boards';

describe('home plaques', () => {
  it('mark only the tall home in tube-211, with red', () => {
    const plaques = homePlaques(TUBE_211);
    expect(plaques.filter((colors) => colors.length)).toEqual([['red']]);
    expect(TUBE_211.containers![plaques.findIndex((colors) => colors.length)]!.capacity).toBe(6);
  });
  it('leave every registered campaign tube board unchanged', () => {
    const campaign = new Set(CAMPAIGN.map((level) => level.id));
    for (const board of TUBE_BOARDS.filter((entry) => campaign.has(entry.id))) expect(homePlaques(board).flat(), board.id).toEqual([]);
  });
  it('never stack more than two on one home', () => {
    for (const board of TUBE_BOARDS) for (const colors of homePlaques(board)) expect(colors.length, board.id).toBeLessThanOrEqual(2);
  });
});

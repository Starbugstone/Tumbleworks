import { describe, expect, it } from 'vitest';
import { boardChapter } from '../../src/world/board-village';
import { existsSync } from 'node:fs';
import themes from '../../src/world/village-themes.json' with { type: 'json' };
import { CAMPAIGN } from '../../src/campaign';
import { worldLocation } from '../../src/world/locations';
import { WORKSHOP_PROJECTS } from '../../src/world/workshop-projects';
import { boardBackdrop, boardVillage, setBoardVillage } from '../../src/view/yard-backdrop';

describe('the village a board is played in', () => {
  it('follows a campaign level\'s place: thirty levels to a village', () => {
    expect([0, 29, 30, 59, 60, 179].map((index) => boardChapter('campaign', index, 'any'))).toEqual([0, 0, 1, 1, 2, 5]);
  });

  it('is the village a Workshop project builds for, and none for a level with no project', () => {
    for (const project of WORKSHOP_PROJECTS) expect(boardChapter('workshop', 0, project.id)).toBe(project.chapter);
    expect(boardChapter('workshop', 3, 'board-1')).toBeNull();
  });

  it('floats harbour boards on water and stands every other village\'s boards on its land', () => {
    for (let chapter = 0; chapter < 12; chapter++) {
      setBoardVillage(chapter);
      expect(boardVillage()).toBe(chapter);
      expect(boardBackdrop().kind, worldLocation(chapter).name).toBe(worldLocation(chapter).kind === 'harbour' ? 'water' : 'land');
    }
    setBoardVillage(null);
    expect(boardBackdrop().kind).toBe('water');
  });
});


it('keeps each island’s artwork and demo links valid as the campaign grows', () => {
  const ids = themes.map(theme => theme.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const [chapter, theme] of themes.entries()) {
    expect(theme.name).toHaveLength(2);
    for (const paint of [theme.terrain, theme.roof, theme.accent]) expect(paint).toMatch(/^#[0-9a-f]{6}$/i);
    if (theme.print) expect(existsSync(new URL('../../public/' + theme.print, import.meta.url))).toBe(true);
    for (const card of theme.demo ?? []) {
      expect(existsSync(new URL('../../public/' + card.image, import.meta.url))).toBe(true);
      if (card.level === 'village') continue;
      const index = CAMPAIGN.findIndex(level => level.id === card.level);
      expect(index, card.level).toBeGreaterThanOrEqual(0);
      expect(boardChapter('campaign', index, card.level)).toBe(chapter);
    }
  }
});

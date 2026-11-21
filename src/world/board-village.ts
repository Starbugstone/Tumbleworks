import { LEVELS_PER_STOP, STOPS_PER_CHAPTER } from './progression';
import { workshopProject } from './workshop-projects';

/**
 * The village a board is played in, as a chapter index: a campaign level belongs to the chapter its place in the
 * campaign falls in, and a Workshop project to the village it builds for. Null when a board belongs to none, such
 * as a Workshop level with no registered project. `worldLocation(chapter)` gives that village's theme.
 */
export function boardChapter(source: 'campaign' | 'workshop', index: number, id: string): number | null {
  if (source === 'workshop') return workshopProject(id)?.chapter ?? null;
  return Math.floor(index / (LEVELS_PER_STOP * STOPS_PER_CHAPTER));
}

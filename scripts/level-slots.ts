import type { Slot } from './level-curve';

/** What each campaign level is for in its game's rhythm. docs/levelling.md explains the slots. */
export const SLOTS: Readonly<Record<string, Slot>> = {
  'board-1': 'tutorial', 'board-31': 'ordinary', 'board-32': 'ordinary', 'board-40': 'lesson', 'board-41': 'peak', 'board-42': 'relief',
  'board-43': 'lesson', 'board-44': 'ordinary', 'board-17': 'peak', 'board-46': 'lesson', 'board-2': 'relief', 'board-47': 'ordinary',
  'loop-1': 'tutorial', 'loop-2': 'tutorial', 'loop-31': 'ordinary', 'loop-41': 'lesson', 'loop-42': 'peak', 'loop-43': 'ordinary',
  'loop-44': 'lesson', 'loop-45': 'ordinary', 'loop-46': 'ordinary', 'loop-48': 'peak', 'loop-39': 'relief', 'loop-47': 'relief',
  'tube-1': 'tutorial', 'tube-31': 'ordinary', 'tube-32': 'ordinary', 'tube-38': 'lesson', 'tube-39': 'ordinary', 'tube-40': 'lesson',
  'tube-41': 'peak', 'tube-42': 'ordinary', 'tube-43': 'lesson', 'tube-44': 'lesson', 'tube-37': 'relief', 'tube-46': 'peak',
};

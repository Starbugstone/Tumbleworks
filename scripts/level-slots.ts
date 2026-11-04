import type { Slot } from './level-curve';

/** What each campaign level is for in its game's rhythm. docs/levelling.md explains the slots. */
export const SLOTS: Readonly<Record<string, Slot>> = {
  'board-1': 'tutorial', 'board-31': 'ordinary', 'board-32': 'ordinary', 'board-40': 'lesson', 'board-41': 'peak', 'board-42': 'relief',
  'board-43': 'lesson', 'board-44': 'ordinary', 'board-17': 'peak', 'board-46': 'lesson', 'board-2': 'relief', 'board-47': 'ordinary',
  'loop-1': 'tutorial', 'loop-2': 'tutorial', 'loop-31': 'ordinary', 'loop-41': 'lesson', 'loop-42': 'peak', 'loop-43': 'ordinary',
  'loop-44': 'lesson', 'loop-45': 'ordinary', 'loop-46': 'ordinary', 'loop-48': 'peak', 'loop-39': 'relief', 'loop-47': 'relief',
  'tube-1': 'tutorial', 'tube-31': 'ordinary', 'tube-32': 'ordinary', 'tube-38': 'lesson', 'tube-39': 'ordinary', 'tube-40': 'lesson',
  'tube-41': 'peak', 'tube-42': 'ordinary', 'tube-43': 'lesson', 'tube-44': 'lesson', 'tube-37': 'relief', 'tube-46': 'peak',
  'board-48': 'ordinary', 'board-49': 'peak', 'board-50': 'ordinary', 'board-51': 'relief', 'board-52': 'lesson', 'board-53': 'ordinary', 'board-54': 'peak', 'board-55': 'ordinary',
  'loop-50': 'ordinary', 'loop-51': 'ordinary', 'loop-52': 'peak', 'loop-53': 'ordinary', 'loop-54': 'relief', 'loop-55': 'lesson', 'loop-56': 'ordinary', 'loop-57': 'peak',
  'tube-47': 'ordinary', 'tube-48': 'relief', 'tube-49': 'ordinary', 'tube-50': 'lesson', 'tube-51': 'peak', 'tube-52': 'ordinary', 'tube-53': 'relief', 'tube-54': 'ordinary',
};

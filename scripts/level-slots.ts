import type { Slot } from './level-curve';

/** What each campaign level is for in its game's rhythm. docs/levelling.md explains the slots. */
export const SLOTS: Readonly<Record<string, Slot>> = {
  'board-1': 'tutorial', 'board-31': 'ordinary', 'board-32': 'ordinary', 'board-33': 'lesson', 'board-34': 'peak', 'board-35': 'relief',
  'board-36': 'lesson', 'board-37': 'ordinary', 'board-2': 'peak', 'board-3': 'lesson', 'board-38': 'relief', 'board-39': 'ordinary',
  'loop-1': 'tutorial', 'loop-2': 'tutorial', 'loop-31': 'ordinary', 'loop-32': 'lesson', 'loop-33': 'peak', 'loop-34': 'ordinary',
  'loop-35': 'lesson', 'loop-36': 'ordinary', 'loop-37': 'ordinary', 'loop-38': 'lesson', 'loop-39': 'peak', 'loop-40': 'relief',
  'tube-1': 'tutorial', 'tube-31': 'ordinary', 'tube-32': 'ordinary', 'tube-33': 'lesson', 'tube-34': 'ordinary', 'tube-2': 'lesson',
  'tube-35': 'peak', 'tube-36': 'ordinary', 'tube-3': 'lesson', 'tube-4': 'lesson', 'tube-9': 'relief', 'tube-37': 'peak',
};

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
  'board-56': 'lesson', 'board-57': 'ordinary', 'board-58': 'ordinary', 'board-59': 'peak', 'board-60': 'relief', 'board-61': 'lesson', 'board-62': 'ordinary', 'board-63': 'ordinary', 'board-64': 'peak', 'board-65': 'ordinary', 'board-66': 'relief', 'board-67': 'ordinary', 'board-68': 'ordinary', 'board-69': 'peak', 'board-70': 'ordinary', 'board-71': 'lesson', 'board-72': 'ordinary', 'board-73': 'ordinary', 'board-74': 'peak', 'board-75': 'ordinary',
  'loop-58': 'ordinary', 'loop-59': 'relief', 'loop-60': 'ordinary', 'loop-61': 'ordinary', 'loop-62': 'peak', 'loop-63': 'ordinary', 'loop-64': 'relief', 'loop-65': 'lesson', 'loop-66': 'ordinary', 'loop-67': 'peak', 'loop-68': 'ordinary', 'loop-69': 'relief', 'loop-70': 'ordinary', 'loop-71': 'ordinary', 'loop-72': 'peak', 'loop-73': 'ordinary', 'loop-74': 'relief', 'loop-75': 'lesson', 'loop-76': 'ordinary', 'loop-77': 'peak',
  'tube-55': 'ordinary', 'tube-56': 'peak', 'tube-57': 'ordinary', 'tube-58': 'relief', 'tube-59': 'lesson', 'tube-60': 'ordinary', 'tube-61': 'peak', 'tube-62': 'ordinary', 'tube-63': 'relief', 'tube-64': 'ordinary', 'tube-65': 'ordinary', 'tube-66': 'peak', 'tube-67': 'lesson', 'tube-68': 'relief', 'tube-69': 'ordinary', 'tube-70': 'ordinary', 'tube-71': 'peak', 'tube-72': 'ordinary', 'tube-73': 'relief', 'tube-74': 'ordinary',
  // Rounds 41–60.
  'board-200': 'lesson', 'board-79': 'ordinary', 'board-76': 'ordinary', 'board-80': 'peak', 'board-81': 'ordinary', 'board-77': 'relief', 'board-82': 'ordinary', 'board-83': 'ordinary', 'board-84': 'peak', 'board-85': 'ordinary', 'board-86': 'relief', 'board-87': 'ordinary', 'board-88': 'ordinary', 'board-89': 'peak', 'board-90': 'ordinary', 'board-91': 'relief', 'board-201': 'lesson', 'board-92': 'ordinary', 'board-78': 'peak', 'board-93': 'relief',
  'loop-78': 'ordinary', 'loop-79': 'relief', 'loop-200': 'lesson', 'loop-80': 'relief', 'loop-81': 'peak', 'loop-82': 'ordinary', 'loop-83': 'relief', 'loop-84': 'ordinary', 'loop-85': 'ordinary', 'loop-86': 'peak', 'loop-87': 'ordinary', 'loop-88': 'relief', 'loop-89': 'ordinary', 'loop-90': 'ordinary', 'loop-91': 'peak', 'loop-92': 'ordinary', 'loop-93': 'relief', 'loop-94': 'ordinary', 'loop-95': 'lesson', 'loop-96': 'peak',
  'tube-75': 'ordinary', 'tube-76': 'peak', 'tube-77': 'ordinary', 'tube-78': 'relief', 'tube-200': 'lesson', 'tube-79': 'ordinary', 'tube-80': 'peak', 'tube-81': 'ordinary', 'tube-82': 'relief', 'tube-83': 'ordinary', 'tube-84': 'ordinary', 'tube-85': 'peak', 'tube-86': 'ordinary', 'tube-87': 'relief', 'tube-88': 'ordinary', 'tube-89': 'ordinary', 'tube-90': 'peak', 'tube-91': 'ordinary', 'tube-92': 'relief', 'tube-93': 'ordinary',
};

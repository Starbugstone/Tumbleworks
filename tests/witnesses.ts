/** Authored tap orders, shared by the rule, machine and browser specs. Letters are supply columns or truck lanes. */
export const FUNNEL_WITNESSES: Record<string, string> = {
  'board-1': 'AAB', 'board-2': 'AABBC', 'board-3': 'AAABBCC', 'board-4': 'AAABBBCCC', 'board-5': 'ABAABBCCCDDD',
};
export const FUNNEL_JAMS: Record<string, string> = { 'board-1': 'AB', 'board-2': 'AB', 'board-3': 'AABBC', 'board-4': 'AAC', 'board-5': 'AAABBBC' };
export const LOOP_WITNESSES: Record<string, string> = { 'loop-1': 'AB', 'loop-2': 'ABC', 'loop-3': 'AABC', 'loop-4': 'ABDABC', 'loop-5': 'AACBBDACD' };
/** Loop 1 is the tutorial: its complete tap tree has no losing order. */
export const LOOP_JAMS: Record<string, string> = { 'loop-2': 'B', 'loop-3': 'AB', 'loop-4': 'AA', 'loop-5': 'AAB' };

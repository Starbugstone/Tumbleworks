/** Authored tap orders, shared by the rule, machine and browser specs. Letters are supply columns or truck lanes. */
export const FUNNEL_WITNESSES: Record<string, string> = {
  'board-1': 'AAB', 'board-2': 'AABBC', 'board-3': 'AAABBCC', 'board-4': 'AAABBBCCC', 'board-5': 'ABAABBCCCDDD',
  'board-6': 'AABC', 'board-7': 'AAABBCC',
};
export const FUNNEL_JAMS: Record<string, string> = { 'board-1': 'AB', 'board-2': 'AB', 'board-3': 'AABBC', 'board-4': 'AAC', 'board-5': 'AAABBBC', 'board-6': 'ABC', 'board-7': 'AABBC' };
export const LOOP_WITNESSES: Record<string, string> = { 'loop-1': 'AB', 'loop-2': 'ABC', 'loop-3': 'AABC', 'loop-4': 'ABDABC', 'loop-5': 'AACBBDACD', 'loop-6': 'ABDABC', 'loop-7': 'AACBBDACD' };
/** The first two Loop levels teach exchange without losing tap orders; traffic pressure starts later. */
export const LOOP_JAMS: Record<string, string> = { 'loop-3': 'AB', 'loop-4': 'AA', 'loop-5': 'AAB', 'loop-6': 'AA', 'loop-7': 'AAB' };

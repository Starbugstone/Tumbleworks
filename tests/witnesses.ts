/** Authored tap orders, shared by the rule, machine and browser specs. Letters are supply columns or truck lanes. */
export const FUNNEL_WITNESSES: Record<string, string> = {
  'board-202': 'ACCABB',
  'board-201': 'EFCDAB',
  'board-200': 'ABEFD',
  'board-1': 'AAB', 'board-2': 'AABBC', 'board-3': 'AAABCCB', 'board-4': 'ABCAABBCC', 'board-5': 'AAABBBDCCCDD', 'board-6': 'AAACBBC',
  'board-7': 'AAACCBB', 'board-8': 'AAACBBBC', 'board-9': 'AABDBDCCDAB', 'board-10': 'AABBABCCC', 'board-11': 'AAABBCCCDDDB', 'board-12': 'ABBAAB',
  'board-13': 'ABABCC', 'board-14': 'BDDDAAACC', 'board-15': 'ABABCCDD', 'board-16': 'AAABCCBC', 'board-17': 'CCAABB', 'board-18': 'AABBACCCB',
  'board-19': 'AAABBBDCCCDD', 'board-20': 'AABCBBCDDD', 'board-21': 'AACCCBBAB', 'board-22': 'AABBDDCC', 'board-23': 'AAAABCDDCCBBD', 'board-24': 'AABBCCDDBDCA',
  'board-25': 'AABBCCBAC', 'board-26': 'AAABBCCABB', 'board-27': 'BCCBCABAA', 'board-28': 'ABBADBCCDCACAD', 'board-29': 'AAACDDBDBBCC', 'board-30': 'ABDDDACCCAABBB',
  // BEGIN first stretch funnel witnesses
  'board-31': 'AABB', 'board-32': 'AABBC', 'board-33': 'ABBACC', 'board-34': 'AACCBB', 'board-35': 'AABBC', 'board-36': 'AABBCC', 'board-37': 'AABCCB', 'board-38': 'AAACCBB', 'board-39': 'AABBCBCA', 'board-40': 'AACCBB', 'board-41': 'AABCCB', 'board-42': 'AAABBCC', 'board-43': 'ACCBBA', 'board-44': 'BBBCAAAC', 'board-46': 'AAABBBCC', 'board-47': 'AAABBBCCC',
  // END first stretch funnel witnesses
};
export const FUNNEL_JAMS: Record<string, string> = {
  'board-202': 'AAB',
  'board-201': 'AC',
  'board-200': 'ABDE',
  'board-1': 'AB', 'board-2': 'AB', 'board-3': 'AAABB', 'board-4': 'AA', 'board-5': 'AAABBBC', 'board-6': 'AAAB',
  'board-7': 'AAABB', 'board-8': 'AAAB', 'board-9': 'AAA', 'board-10': 'AAAB', 'board-11': 'AAABBBC', 'board-12': 'AA',
  'board-13': 'AA', 'board-14': 'AAABC', 'board-15': 'AA', 'board-16': 'AAABBC', 'board-17': 'AA', 'board-18': 'AAAB',
  'board-19': 'AAABBBC', 'board-20': 'AABB', 'board-21': 'AAAB', 'board-22': 'AABBC', 'board-23': 'AAAABBBC', 'board-24': 'AAAB',
  'board-25': 'AAABBBC', 'board-26': 'AAAABBB', 'board-27': 'AAA', 'board-28': 'AAAAB', 'board-29': 'AAABB', 'board-30': 'AAAA',
  // BEGIN first stretch funnel jams
  'board-33': 'AAB', 'board-34': 'AABB', 'board-35': 'AB', 'board-36': 'ABB', 'board-37': 'AABBC', 'board-38': 'AAABC', 'board-39': 'AAAB', 'board-40': 'AABB', 'board-41': 'AABBC', 'board-42': 'AAABCC', 'board-43': 'AAB', 'board-44': 'AA', 'board-46': 'AAABBC', 'board-47': 'AAABBCC',
  // END first stretch funnel jams
};
/** Funnel Sort's easy opening boards have no real trap. */
export const FUNNEL_NO_JAM: readonly string[] = ['board-31', 'board-32'];
export const LOOP_WITNESSES: Record<string, string> = {
  'loop-200': 'BBAACA',   'loop-201': 'AAABCC',   'loop-202': 'AABCC',
  'loop-1': 'AB', 'loop-2': 'ABC', 'loop-3': 'AABC', 'loop-4': 'ABDABC', 'loop-5': 'AACBBDACD', 'loop-6': 'AABBCDCBD',
  'loop-7': 'ABBACCABDDCD', 'loop-8': 'BDAABCBDD', 'loop-9': 'AABAABCDDEBDE', 'loop-10': 'CDDBCBCB', 'loop-11': 'AABBCDDADBC', 'loop-12': 'ABBABABA',
  'loop-13': 'AACACBCBC', 'loop-14': 'ABBCCDDDDCCB', 'loop-15': 'AABEEDC', 'loop-16': 'ACCDDBBCBAA', 'loop-17': 'ABBCCAB', 'loop-18': 'ABCDBEBDAECC',
  'loop-19': 'AABCCDADBDB', 'loop-20': 'AABBABDCCDAACD', 'loop-21': 'BCCBABDDDA', 'loop-22': 'AACCBAACBAB', 'loop-23': 'AABBBDACDCDC', 'loop-24': 'CAABBBCC',
  'loop-25': 'AABBBCCDDECEAE', 'loop-26': 'ABCCBCCDDABA', 'loop-27': 'ABBCCDAAADABD', 'loop-28': 'ACACDDBDB', 'loop-29': 'AABBAACDDCCBA', 'loop-30': 'ABABCCDDCEEBD',
  'loop-31': 'ABC',
  // BEGIN first stretch loop witnesses
  'loop-32': 'ABAC', 'loop-33': 'ABBCA', 'loop-34': 'ABCAB', 'loop-35': 'ABACB', 'loop-36': 'ABCCAB', 'loop-37': 'ABCCAB', 'loop-38': 'ABCBAC', 'loop-39': 'AABACCBCB', 'loop-40': 'AABBABBCC', 'loop-41': 'ABACBC', 'loop-42': 'AABBCCABC', 'loop-43': 'ABCABC', 'loop-44': 'ABBCCAAB', 'loop-45': 'ABBACCBCDD', 'loop-46': 'AABBCABCC', 'loop-47': 'ABCBAC', 'loop-48': 'AABBBBACCCDD',
  // END first stretch loop witnesses
};
/** The first two Loop levels teach exchange without losing tap orders; traffic pressure starts later. */
export const LOOP_JAMS: Record<string, string> = {
  'loop-200': 'BCB',   'loop-201': 'AABC',   'loop-202': 'ACC',
  'loop-3': 'AB', 'loop-4': 'AA', 'loop-5': 'AAB', 'loop-6': 'AABBCC', 'loop-7': 'AA', 'loop-8': 'BB',
  'loop-9': 'AABAAC', 'loop-10': 'B', 'loop-11': 'AABBCBDDA', 'loop-12': 'AABB', 'loop-13': 'AABCABC', 'loop-14': 'ABBCCCCD',
  'loop-15': 'AABC', 'loop-16': 'ABBCCD', 'loop-17': 'AA', 'loop-18': 'AA', 'loop-19': 'AABBCCABDD', 'loop-20': 'AABBABC',
  'loop-21': 'ABA', 'loop-22': 'AABABAABCC', 'loop-23': 'AABBBC', 'loop-24': 'BABBCCC', 'loop-25': 'AABBBACCD', 'loop-26': 'AAABBC',
  'loop-27': 'AA', 'loop-28': 'ABABCCDD', 'loop-29': 'AABBAACAC', 'loop-30': 'ABABBCC',
  // BEGIN first stretch loop jams
  'loop-32': 'ABC', 'loop-33': 'ACAB', 'loop-34': 'ABAC', 'loop-35': 'AAB', 'loop-36': 'AAB', 'loop-37': 'ABCA', 'loop-38': 'ABCC', 'loop-39': 'AABABC', 'loop-40': 'AAABB', 'loop-41': 'ABAB', 'loop-42': 'AABCCA', 'loop-43': 'ABB', 'loop-44': 'ABBB', 'loop-45': 'ABBABC', 'loop-46': 'AAABB', 'loop-47': 'ABBAC', 'loop-48': 'AABBA',
  // END first stretch loop jams
};
/**
 * One recorded multi-tap win per conveyor board from round 4, from a seeded burst player: the tick and supply or lane of each tap.
 * It proves a fast line exists. scripts/level-emit.ts writes them; replay them with replayOnto.
 */
export const FAST_WITNESSES: Record<string, { readonly steps: number; readonly taps: readonly (readonly [number, number])[] }> = {
  'loop-200': { steps: 1347, taps: [[1,1],[241,1],[511,2],[517,0],[731,0],[1091,0]] },
  'loop-201': { steps: 479, taps: [[1,0],[13,2],[58,0],[61,2],[106,0],[109,1]] },
  'loop-202': { steps: 1001, taps: [[1,0],[13,2],[208,2],[217,0],[570,1]] },

  // BEGIN first stretch fast witnesses
  'board-2': { steps: 918, taps: [[1,0],[13,0],[59,1],[61,1],[569,2]] },
  'board-3': { steps: 923, taps: [[1,0],[13,0],[170,2],[181,0],[430,2],[433,1],[658,1]] },
  'board-17': { steps: 958, taps: [[1,2],[13,2],[59,0],[61,0],[674,1],[685,1]] },
  'board-31': { steps: 702, taps: [[1,0],[13,0],[59,1],[61,1]] },
  'board-32': { steps: 661, taps: [[1,0],[13,0],[59,1],[61,1],[398,2]] },
  'board-33': { steps: 1033, taps: [[1,0],[13,1],[170,1],[181,2],[479,2],[481,0]] },
  'board-34': { steps: 927, taps: [[1,0],[13,0],[170,2],[181,2],[406,1],[409,1]] },
  'board-35': { steps: 1000, taps: [[1,1],[13,2],[59,0],[61,0],[200,1]] },
  'board-36': { steps: 701, taps: [[1,0],[13,0],[170,2],[181,1],[357,2],[361,1]] },
  'board-37': { steps: 1129, taps: [[1,0],[13,0],[170,2],[181,1],[341,2],[349,1]] },
  'board-38': { steps: 1497, taps: [[1,0],[13,1],[170,0],[181,1],[406,2],[409,2],[626,0]] },
  'board-39': { steps: 1108, taps: [[1,0],[13,1],[170,2],[181,1],[390,2],[397,1],[634,0],[637,0]] },
  'loop-32': { steps: 2687, taps: [[1,0],[13,1],[58,2],[581,0]] },
  'loop-33': { steps: 488, taps: [[1,0],[13,1],[58,2],[229,1],[241,0]] },
  'loop-34': { steps: 1174, taps: [[1,0],[13,1],[123,2],[301,0],[382,1]] },
  'loop-35': { steps: 2596, taps: [[1,0],[13,1],[83,2],[276,1],[277,0]] },
  'loop-36': { steps: 1634, taps: [[1,0],[13,1],[149,2],[215,0],[390,2],[1236,1]] },
  'loop-37': { steps: 2688, taps: [[1,0],[13,1],[58,2],[529,2],[730,0],[2433,1]] },
  'loop-38': { steps: 3396, taps: [[1,0],[13,1],[58,2],[417,2],[614,1],[2713,0]] },
  'loop-39': { steps: 1580, taps: [[1,2],[13,0],[138,1],[145,2],[244,0],[253,1],[490,2],[1001,0],[1198,1]] },
  'loop-40': { steps: 3718, taps: [[1,0],[13,1],[60,1],[61,0],[106,2],[159,2],[349,0],[361,1],[3316,1]] },
  'board-40': { steps: 902, taps: [[1,0],[13,0],[170,2],[181,2],[439,1],[445,1]] },
  'board-41': { steps: 1284, taps: [[1,1],[13,0],[162,2],[169,0],[447,2],[457,1]] },
  'board-42': { steps: 850, taps: [[1,0],[13,1],[170,1],[181,0],[406,0],[409,2],[609,2]] },
  'board-43': { steps: 2293, taps: [[1,0],[13,2],[59,2],[61,1],[559,1],[565,0]] },
  'board-44': { steps: 1866, taps: [[1,1],[13,1],[186,2],[193,0],[327,1],[337,2],[943,0],[949,0]] },
  'board-46': { steps: 2089, taps: [[1,0],[13,0],[59,0],[61,2],[107,2],[109,1],[594,1],[601,1]] },
  'board-47': { steps: 1776, taps: [[1,0],[13,1],[170,0],[181,1],[390,0],[397,2],[507,2],[517,2],[1130,1]] },
  'loop-41': { steps: 3142, taps: [[1,0],[13,1],[58,2],[558,0],[1900,2],[2076,1]] },
  'loop-42': { steps: 1070, taps: [[1,0],[13,1],[58,2],[61,0],[106,2],[109,1],[456,0],[546,1],[757,2]] },
  'loop-43': { steps: 1454, taps: [[1,0],[13,1],[58,2],[878,1],[1019,2],[1065,0]] },
  'loop-44': { steps: 1346, taps: [[1,0],[13,1],[58,2],[268,1],[277,2],[604,1],[787,0],[936,0]] },
  'loop-45': { steps: 1587, taps: [[1,0],[13,1],[58,3],[61,2],[287,1],[691,3],[697,2],[778,1],[781,0],[942,2]] },
  'loop-46': { steps: 1295, taps: [[1,0],[13,1],[58,2],[61,0],[255,1],[265,0],[875,1],[1025,2],[1084,2]] },
  'loop-47': { steps: 3828, taps: [[1,2],[13,0],[74,1],[85,2],[229,1],[3598,0]] },
  'loop-48': { steps: 2044, taps: [[1,0],[13,1],[115,1],[121,2],[277,3],[289,0],[607,3],[613,1],[674,1],[685,0],[850,2],[1814,2]] },
  // END first stretch fast witnesses
};

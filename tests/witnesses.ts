/** Authored tap orders, shared by the rule, machine and browser specs. Letters are supply columns or truck lanes. */
export const FUNNEL_WITNESSES: Record<string, string> = {
  'board-1': 'AAB', 'board-2': 'AABBC', 'board-3': 'AAABCCB', 'board-4': 'ABCAABBCC', 'board-5': 'AAABBBDCCCDD', 'board-6': 'AAACBBC',
  'board-7': 'AAACCBB', 'board-8': 'AAACBBBC', 'board-9': 'AABDBDCCDAB', 'board-10': 'AABBABCCC', 'board-11': 'AAABBCCCDDDB', 'board-12': 'ABBAAB',
  'board-13': 'ABABCC', 'board-14': 'BDDDAAACC', 'board-15': 'ABABCCDD', 'board-16': 'AAABCCBC', 'board-17': 'CCAABB', 'board-18': 'AABBACCCB',
  'board-19': 'AAABBBDCCCDD', 'board-20': 'AABCBBCDDD', 'board-21': 'AACCCBBAB', 'board-22': 'AABBDDCC', 'board-23': 'AAAABCDDCCBBD', 'board-24': 'AABBCCDDBDCA',
  'board-25': 'AABBCCBAC', 'board-26': 'AAABBCCABB', 'board-27': 'BCCBCABAA', 'board-28': 'ABBADBCCDCACAD', 'board-29': 'AAACDDBDBBCC', 'board-30': 'ABDDDACCCAABBB',
};
export const FUNNEL_JAMS: Record<string, string> = {
  'board-1': 'AB', 'board-2': 'AB', 'board-3': 'AAABB', 'board-4': 'AA', 'board-5': 'AAABBBC', 'board-6': 'AAAB',
  'board-7': 'AAABB', 'board-8': 'AAAB', 'board-9': 'AAA', 'board-10': 'AAAB', 'board-11': 'AAABBBC', 'board-12': 'AA',
  'board-13': 'AA', 'board-14': 'AAABC', 'board-15': 'AA', 'board-16': 'AAABBC', 'board-17': 'AA', 'board-18': 'AAAB',
  'board-19': 'AAABBBC', 'board-20': 'AABB', 'board-21': 'AAAB', 'board-22': 'AABBC', 'board-23': 'AAAABBBC', 'board-24': 'AAAB',
  'board-25': 'AAABBBC', 'board-26': 'AAAABBB', 'board-27': 'AAA', 'board-28': 'AAAAB', 'board-29': 'AAABB', 'board-30': 'AAAA',
};
export const LOOP_WITNESSES: Record<string, string> = {
  'loop-1': 'AB', 'loop-2': 'ABC', 'loop-3': 'AABC', 'loop-4': 'ABDABC', 'loop-5': 'AACBBDACD', 'loop-6': 'AABBCDCBD',
  'loop-7': 'ABBACCABDDCD', 'loop-8': 'BDAABCBDD', 'loop-9': 'AABAABCDDEBDE', 'loop-10': 'CDDBCBCB', 'loop-11': 'AABBCDDADBC', 'loop-12': 'ABBABABA',
  'loop-13': 'AACACBCBC', 'loop-14': 'ABBCCDDDDCCB', 'loop-15': 'AABEEDC', 'loop-16': 'ACCDDBBCBAA', 'loop-17': 'ABBCCAB', 'loop-18': 'ABCDBEBDAECC',
  'loop-19': 'AABCCDADBDB', 'loop-20': 'AABBABDCCDAACD', 'loop-21': 'BCCBABDDDA', 'loop-22': 'AACCBAACBAB', 'loop-23': 'AABBBDACDCDC', 'loop-24': 'CAABBBCC',
  'loop-25': 'AABBBCCDDECEAE', 'loop-26': 'ABCCBCCDDABA', 'loop-27': 'ABBCCDAAADABD', 'loop-28': 'ACACDDBDB', 'loop-29': 'AABBAACDDCCBA', 'loop-30': 'ABABCCDDCEEBD',
};
/** The first two Loop levels teach exchange without losing tap orders; traffic pressure starts later. */
export const LOOP_JAMS: Record<string, string> = {
  'loop-3': 'AB', 'loop-4': 'AA', 'loop-5': 'AAB', 'loop-6': 'AABBCC', 'loop-7': 'AA', 'loop-8': 'BB',
  'loop-9': 'AABAAC', 'loop-10': 'B', 'loop-11': 'AABBCBDDA', 'loop-12': 'AABB', 'loop-13': 'AABCABC', 'loop-14': 'ABBCCCCD',
  'loop-15': 'AABC', 'loop-16': 'ABBCCD', 'loop-17': 'AA', 'loop-18': 'AA', 'loop-19': 'AABBCCABDD', 'loop-20': 'AABBABC',
  'loop-21': 'ABA', 'loop-22': 'AABABAABCC', 'loop-23': 'AABBBC', 'loop-24': 'BABBCCC', 'loop-25': 'AABBBACCD', 'loop-26': 'AAABBC',
  'loop-27': 'AA', 'loop-28': 'ABABCCDD', 'loop-29': 'AABBAACAC', 'loop-30': 'ABABBCC',
};

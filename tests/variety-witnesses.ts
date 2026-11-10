/** Machine-verified Workshop paths; letters are crate IDs on source variants, otherwise columns/lanes. */
export const VARIETY_FUNNEL_WITNESSES: Readonly<Record<string, string>> = {
  "board-210": "CDABEF",
  "board-211": "EFABD",
  "board-212": "AACBBC"
};
export const VARIETY_FUNNEL_JAMS: Readonly<Record<string, string>> = {
  "board-210": "AC",
  "board-211": "A",
  "board-212": "AAB"
};
export const VARIETY_LOOP_WITNESSES: Readonly<Record<string, string>> = {
  "loop-210": "ACACB",
  "loop-211": "AACBC"
};
export const VARIETY_LOOP_JAMS: Readonly<Record<string, string>> = {
  "loop-210": "CCA",
  "loop-211": "ABC"
};
export const VARIETY_FAST_WITNESSES: Readonly<Record<string, { readonly steps: number; readonly taps: readonly (readonly [number, number])[] }>> = {
  "board-210": {
    "steps": 1192,
    "taps": [
      [
        1,
        4
      ],
      [
        13,
        5
      ],
      [
        59,
        0
      ],
      [
        61,
        2
      ],
      [
        183,
        1
      ],
      [
        193,
        3
      ]
    ]
  },
  "board-211": {
    "steps": 1199,
    "taps": [
      [
        1,
        0
      ],
      [
        13,
        1
      ],
      [
        59,
        4
      ],
      [
        61,
        3
      ],
      [
        514,
        5
      ]
    ]
  },
  "board-212": {
    "steps": 1030,
    "taps": [
      [
        1,
        0
      ],
      [
        13,
        0
      ],
      [
        59,
        2
      ],
      [
        61,
        1
      ],
      [
        487,
        2
      ],
      [
        493,
        1
      ]
    ]
  },
  "loop-210": {
    "steps": 3533,
    "taps": [
      [
        1,
        0
      ],
      [
        13,
        2
      ],
      [
        601,
        2
      ],
      [
        781,
        1
      ],
      [
        3171,
        0
      ]
    ]
  },
  "loop-211": {
    "steps": 3464,
    "taps": [
      [
        1,
        0
      ],
      [
        13,
        2
      ],
      [
        551,
        2
      ],
      [
        721,
        1
      ],
      [
        2701,
        0
      ]
    ]
  }
};

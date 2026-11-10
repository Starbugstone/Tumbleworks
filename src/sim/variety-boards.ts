import type { BoardDef } from './types';

/** Choose a shelf. Generated seed 23; machine win and jam retained in tests/variety-witnesses.ts. */
export const BOARD_210: BoardDef = {
  "id": "board-210",
  "title": "Choose a shelf",
  "beltCapacity": 14,
  "boxSize": 3,
  "supplies": [
    [
      {
        "color": "green",
        "count": 6
      },
      {
        "color": "red",
        "count": 6
      }
    ],
    [
      {
        "color": "blue",
        "count": 9
      },
      {
        "color": "red",
        "count": 9
      }
    ],
    [
      {
        "color": "blue",
        "count": 9
      },
      {
        "color": "red",
        "count": 9
      }
    ]
  ],
  "docks": [
    [
      "red",
      "red",
      "green",
      "green",
      "red",
      "blue"
    ],
    [
      "red",
      "blue",
      "red",
      "blue",
      "red"
    ],
    [
      "red",
      "blue",
      "blue",
      "blue",
      "red"
    ]
  ],
  "predecessors": {
    "0": [],
    "1": [
      0,
      2
    ],
    "2": [],
    "3": [
      2
    ],
    "4": [],
    "5": [
      4
    ]
  }
};

/** Prepare for the pair. Generated seed 14; machine win and jam retained in tests/variety-witnesses.ts. */
export const BOARD_211: BoardDef = {
  "id": "board-211",
  "title": "Prepare for the pair",
  "beltCapacity": 16,
  "boxSize": 3,
  "supplies": [
    [
      {
        "color": "red",
        "count": 9
      },
      {
        "color": "green",
        "count": 9
      }
    ],
    [
      {
        "color": "blue",
        "count": 9
      },
      {
        "color": "red",
        "count": 6
      }
    ],
    [
      {
        "color": "blue",
        "count": 3
      },
      {
        "color": "green",
        "count": 9
      }
    ]
  ],
  "docks": [
    [
      "red",
      "green",
      "green",
      "red",
      "blue"
    ],
    [
      "green",
      "red",
      "blue",
      "red",
      "green"
    ],
    [
      "green",
      "green",
      "blue",
      "red",
      "blue"
    ]
  ],
  "pairs": [
    [
      0,
      2
    ]
  ],
  "seals": [
    {
      "dock": 0,
      "after": {
        "dock": 1,
        "box": 0
      }
    }
  ]
};

/** Leave together. Generated seed 1; machine win and jam retained in tests/variety-witnesses.ts. */
export const BOARD_212: BoardDef = {
  "id": "board-212",
  "title": "Leave together",
  "beltCapacity": 19,
  "boxSize": 3,
  "supplies": [
    [
      {
        "color": "red",
        "count": 9
      },
      {
        "color": "blue",
        "count": 9
      }
    ],
    [
      {
        "color": "red",
        "count": 9
      },
      {
        "color": "red",
        "count": 9
      }
    ],
    [
      {
        "color": "green",
        "count": 9
      },
      {
        "color": "green",
        "count": 9
      }
    ]
  ],
  "docks": [
    [
      "green",
      "red",
      "blue",
      "green",
      "red",
      "green",
      "red",
      "blue",
      "green"
    ],
    [
      "blue",
      "red",
      "red",
      "red",
      "red",
      "green",
      "green",
      "red",
      "red"
    ]
  ],
  "pallets": [
    [
      0,
      1
    ]
  ]
};

export const FUNNEL_VARIETY_BOARDS: readonly BoardDef[] = [BOARD_210, BOARD_211, BOARD_212];

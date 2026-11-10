import type { FunnelRecipe } from '../scripts/funnel-author';
import type { LoopRecipe } from '../scripts/loop-author';

export const VARIETY_FUNNEL_RECIPES: readonly FunnelRecipe[] = [
  {
    "id": "board-210",
    "title": "Choose a shelf",
    "fr": "",
    "note": "Workshop combination; not a campaign placement",
    "colors": 3,
    "columns": [
      2,
      2,
      2
    ],
    "shorts": 2,
    "smalls": 0,
    "docks": 3,
    "capacity": 14,
    "seed": 23,
    "win": [
      0.02,
      0.55
    ],
    "slack": 0,
    "naiveJams": true,
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
  },
  {
    "id": "board-211",
    "title": "Prepare for the pair",
    "fr": "",
    "note": "Workshop combination; not a campaign placement",
    "colors": 3,
    "columns": [
      2,
      2,
      2
    ],
    "shorts": 1,
    "smalls": 1,
    "docks": 3,
    "capacity": 14,
    "seed": 14,
    "win": [
      0.02,
      0.55
    ],
    "slack": 0,
    "naiveJams": true,
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
  },
  {
    "id": "board-212",
    "title": "Leave together",
    "fr": "",
    "note": "Workshop combination; not a campaign placement",
    "colors": 3,
    "columns": [
      2,
      2,
      2
    ],
    "shorts": 0,
    "smalls": 0,
    "docks": 2,
    "capacity": 14,
    "seed": 1,
    "win": [
      0.02,
      0.55
    ],
    "slack": 0,
    "naiveJams": true,
    "pallets": [
      [
        0,
        1
      ]
    ]
  }
];

export const VARIETY_LOOP_RECIPES: readonly LoopRecipe[] = [
  {
    "id": "loop-210",
    "title": "Small truck, big unlock",
    "fr": "",
    "note": "Workshop combination; not a campaign placement",
    "colors": 3,
    "lanes": [
      2,
      1,
      1
    ],
    "segments": 3,
    "capacity": 40,
    "ringMax": 20,
    "seed": 30,
    "win": [
      0.02,
      0.55
    ],
    "naiveJams": true,
    "capacities": [
      [
        12,
        24
      ],
      [
        24
      ],
      [
        24
      ]
    ],
    "latch": [
      "1:0",
      "0:0"
    ]
  },
  {
    "id": "loop-211",
    "title": "One tap, unequal loads",
    "fr": "",
    "note": "Workshop combination; not a campaign placement",
    "colors": 3,
    "lanes": [
      2,
      1,
      1
    ],
    "segments": 3,
    "capacity": 40,
    "ringMax": 20,
    "seed": 10,
    "win": [
      0.02,
      0.55
    ],
    "naiveJams": true,
    "capacities": [
      [
        12,
        24
      ],
      [
        24
      ],
      [
        24
      ]
    ],
    "coupling": [
      "0:0",
      "1:0"
    ]
  }
];


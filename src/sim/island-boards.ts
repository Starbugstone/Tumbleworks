import type { BoardDef } from './types';

export const FUNNEL_ISLAND_BOARDS: readonly BoardDef[] = [
  {
    "id": "board-94",
    "title": "A little more room",
    "beltCapacity": 16,
    "boxSize": 3,
    "supplies": [
      [{"color": "orange", "count": 9}, {"color": "yellow", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "green", "count": 9}],
      [{"color": "blue", "count": 9}, {"color": "red", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "yellow", "count": 9}]
    ],
    "docks": [
      ["yellow", "red", "yellow", "orange", "red", "red", "red", "red"],
      ["green", "yellow", "red", "yellow", "red", "blue", "blue", "orange"],
      ["green", "yellow", "green", "blue", "red", "orange", "red", "yellow"]
    ],
    "trackShape": "delta"
  },
  {
    "id": "board-95",
    "title": "Crates in reserve",
    "beltCapacity": 14,
    "boxSize": 3,
    "supplies": [
      [{"color": "orange", "count": 9}, {"color": "red", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "green", "count": 9}],
      [{"color": "red", "count": 6}, {"color": "blue", "count": 9}],
      [{"color": "yellow", "count": 9}, {"color": "yellow", "count": 9}]
    ],
    "docks": [
      ["green", "red", "yellow", "orange", "red", "yellow", "yellow", "red", "yellow", "green", "red", "red"],
      ["red", "yellow", "green", "red", "blue", "red", "orange", "yellow", "blue", "orange", "blue"]
    ]
  },
  {
    "id": "board-96",
    "title": "Short crates, crossed straps",
    "beltCapacity": 14,
    "boxSize": 3,
    "supplies": [
      [{"color": "red", "count": 9}, {"color": "yellow", "count": 9}, {"color": "yellow", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "blue", "count": 9}],
      [{"color": "yellow", "count": 9}, {"color": "green", "count": 6}]
    ],
    "docks": [
      ["green", "yellow", "red", "yellow", "yellow", "yellow", "blue"],
      ["red", "yellow", "yellow", "red", "yellow", "red", "blue"],
      ["yellow", "green", "blue", "yellow", "red", "red"]
    ],
    "predecessors": {"0": [], "1": [0, 3], "2": [1], "3": [], "4": [3], "5": [], "6": [5]}
  },
  {
    "id": "board-97",
    "title": "Across the belt",
    "beltCapacity": 26,
    "boxSize": 3,
    "supplies": [
      [{"color": "red", "count": 9}, {"color": "green", "count": 9}, {"color": "yellow", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "yellow", "count": 9}, {"color": "green", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "blue", "count": 9}, {"color": "orange", "count": 9}]
    ],
    "docks": [
      [
        "green",
        "blue",
        "yellow",
        "yellow",
        "red",
        "red",
        "blue",
        "red",
        "green",
        "red",
        "red",
        "yellow",
        "green",
        "blue"
      ],
      [
        "yellow",
        "red",
        "red",
        "red",
        "yellow",
        "orange",
        "red",
        "orange",
        "green",
        "green",
        "orange",
        "yellow",
        "green"
      ]
    ],
    "trackShape": "eight"
  },
  {
    "id": "board-98",
    "title": "Room for the next crate",
    "beltCapacity": 16,
    "boxSize": 3,
    "supplies": [
      [{"color": "orange", "count": 9}, {"color": "orange", "count": 9}, {"color": "yellow", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "green", "count": 9}, {"color": "red", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "blue", "count": 9}]
    ],
    "docks": [
      ["orange", "yellow", "red", "red", "blue", "blue", "red", "green"],
      ["red", "red", "orange", "red", "green", "orange", "red", "blue"],
      ["yellow", "orange", "orange", "orange", "green", "red", "yellow", "red"]
    ]
  },
  {
    "id": "board-99",
    "title": "Small loads first",
    "beltCapacity": 22,
    "boxSize": 3,
    "supplies": [
      [{"color": "yellow", "count": 9}, {"color": "orange", "count": 9}, {"color": "yellow", "count": 9}],
      [{"color": "blue", "count": 9}, {"color": "yellow", "count": 9}, {"color": "green", "count": 9}],
      [{"color": "blue", "count": 9}, {"color": "red", "count": 9}, {"color": "red", "count": 9}]
    ],
    "docks": [
      ["yellow", "green", "blue", "orange", "blue", "green", "red", "green", "yellow"],
      ["orange", "yellow", "blue", "yellow", "red", "yellow", "yellow", "red", "blue"],
      ["red", "yellow", "orange", "blue", "red", "yellow", "blue", "yellow", "red"]
    ],
    "trackShape": "kidney"
  },
  {
    "id": "board-100",
    "title": "Two queues to watch",
    "beltCapacity": 14,
    "boxSize": 3,
    "supplies": [
      [{"color": "green", "count": 9}, {"color": "orange", "count": 9}, {"color": "blue", "count": 9}],
      [{"color": "yellow", "count": 9}, {"color": "blue", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "green", "count": 9}],
      [{"color": "red", "count": 9}]
    ],
    "docks": [
      ["orange", "red", "blue", "red", "blue", "yellow", "blue", "green"],
      ["blue", "yellow", "green", "green", "orange", "orange", "blue", "red"],
      ["green", "yellow", "green", "blue", "red", "red", "green", "red"]
    ]
  },
  {
    "id": "board-101",
    "title": "Leave a crate for later",
    "beltCapacity": 14,
    "boxSize": 3,
    "supplies": [
      [{"color": "red", "count": 3}, {"color": "green", "count": 9}, {"color": "green", "count": 9}],
      [{"color": "blue", "count": 9}, {"color": "red", "count": 9}],
      [{"color": "yellow", "count": 6}, {"color": "yellow", "count": 9}]
    ],
    "docks": [
      ["green", "red", "green", "blue", "green", "blue"],
      ["yellow", "red", "yellow", "green", "blue", "green"],
      ["red", "yellow", "yellow", "yellow", "red", "green"]
    ]
  },
  {
    "id": "board-102",
    "title": "Past the bend",
    "beltCapacity": 14,
    "boxSize": 3,
    "supplies": [
      [{"color": "red", "count": 9}, {"color": "black", "count": 9}, {"color": "red", "count": 9}],
      [{"color": "orange", "count": 9}, {"color": "green", "count": 9}, {"color": "black", "count": 9}],
      [{"color": "blue", "count": 9}, {"color": "blue", "count": 6}],
      [{"color": "black", "count": 3}, {"color": "orange", "count": 6}]
    ],
    "docks": [
      ["black", "black", "red", "blue", "black", "orange", "blue", "black", "blue"],
      ["blue", "green", "blue", "red", "green", "green", "red", "black", "orange"],
      ["black", "red", "orange", "orange", "red", "red", "orange", "black"]
    ]
  },
  {
    "id": "board-103",
    "title": "Keep a dock clear",
    "beltCapacity": 14,
    "boxSize": 3,
    "supplies": [
      [{"color": "red", "count": 9}, {"color": "green", "count": 9}, {"color": "yellow", "count": 9}],
      [{"color": "red", "count": 9}],
      [{"color": "yellow", "count": 9}, {"color": "green", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "blue", "count": 9}, {"color": "orange", "count": 9}]
    ],
    "docks": [
      ["green", "yellow", "red", "blue", "green", "red", "green"],
      ["yellow", "red", "yellow", "red", "green", "orange", "green"],
      ["blue", "yellow", "red", "red", "red", "yellow", "blue"],
      ["red", "red", "orange", "orange", "green", "yellow"]
    ]
  },
  {
    "id": "board-104",
    "title": "A measured pour",
    "beltCapacity": 14,
    "boxSize": 3,
    "supplies": [
      [{"color": "red", "count": 9}, {"color": "blue", "count": 9}, {"color": "red", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "red", "count": 9}],
      [{"color": "yellow", "count": 9}, {"color": "green", "count": 9}]
    ],
    "docks": [
      ["red", "red", "green", "green", "red", "red", "red"],
      ["blue", "red", "blue", "red", "red", "red", "blue"],
      ["green", "red", "yellow", "red", "yellow", "yellow", "red"]
    ],
    "pairs": [[0, 3]]
  },
  {
    "id": "board-105",
    "title": "Before the shutter",
    "beltCapacity": 15,
    "boxSize": 3,
    "supplies": [
      [
        {"color": "blue", "count": 9},
        {"color": "red", "count": 9},
        {"color": "blue", "count": 9},
        {"color": "orange", "count": 9}
      ],
      [{"color": "yellow", "count": 9}, {"color": "red", "count": 9}, {"color": "green", "count": 9}],
      [{"color": "green", "count": 9}, {"color": "red", "count": 9}, {"color": "orange", "count": 9}]
    ],
    "docks": [
      ["red", "red", "red", "red", "red", "yellow", "orange", "blue", "orange", "red"],
      ["yellow", "green", "green", "green", "blue", "orange", "orange", "green", "red", "green"],
      ["blue", "blue", "red", "green", "blue", "orange", "yellow", "blue", "red", "orange"]
    ]
  },
  {
    "id": "board-106",
    "title": "Pick the opening",
    "beltCapacity": 14,
    "boxSize": 3,
    "supplies": [
      [{"color": "blue", "count": 9}, {"color": "blue", "count": 9}, {"color": "yellow", "count": 9}],
      [{"color": "red", "count": 6}, {"color": "red", "count": 3}],
      [{"color": "green", "count": 9}, {"color": "green", "count": 9}]
    ],
    "docks": [
      ["yellow", "green", "red", "green", "blue", "green"],
      ["yellow", "blue", "yellow", "red", "green", "blue"],
      ["blue", "green", "green", "blue", "blue", "red"]
    ]
  },
  {
    "id": "board-107",
    "title": "The dock behind the shutter",
    "beltCapacity": 19,
    "boxSize": 3,
    "supplies": [
      [{"color": "green", "count": 9}, {"color": "blue", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "blue", "count": 9}],
      [{"color": "red", "count": 6}, {"color": "blue", "count": 9}],
      [{"color": "orange", "count": 9}, {"color": "yellow", "count": 9}]
    ],
    "docks": [
      ["green", "blue", "orange", "orange", "blue", "yellow", "blue", "green", "yellow", "red", "red", "red"],
      ["yellow", "green", "blue", "blue", "blue", "red", "orange", "blue", "blue", "blue", "red"]
    ],
    "seals": [{"dock": 0, "after": {"dock": 1, "box": 0}}],
    "trackShape": "kidney"
  },
  {
    "id": "board-108",
    "title": "Room for a breather",
    "beltCapacity": 14,
    "boxSize": 3,
    "supplies": [
      [{"color": "black", "count": 9}, {"color": "red", "count": 9}, {"color": "green", "count": 9}],
      [{"color": "black", "count": 9}, {"color": "yellow", "count": 9}, {"color": "green", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "green", "count": 9}]
    ],
    "docks": [
      ["yellow", "yellow", "red", "red", "black", "green", "black", "black"],
      ["green", "red", "green", "red", "black", "black", "green", "green"],
      ["yellow", "red", "green", "black", "green", "red", "green", "green"]
    ]
  },
  {
    "id": "board-109",
    "title": "One handle, one shutter",
    "beltCapacity": 14,
    "boxSize": 3,
    "supplies": [
      [{"color": "blue", "count": 9}],
      [{"color": "yellow", "count": 9}, {"color": "blue", "count": 9}],
      [{"color": "orange", "count": 9}, {"color": "red", "count": 9}, {"color": "green", "count": 9}],
      [{"color": "green", "count": 9}, {"color": "red", "count": 9}]
    ],
    "docks": [
      ["orange", "red", "blue", "red", "blue", "yellow", "blue", "green"],
      ["blue", "yellow", "green", "green", "orange", "orange", "blue", "red"],
      ["green", "yellow", "green", "blue", "red", "red", "green", "red"]
    ],
    "seals": [{"dock": 0, "after": {"dock": 1, "box": 1}}],
    "pairs": [[2, 6]]
  },
  {
    "id": "board-110",
    "title": "Unlock the next dock",
    "beltCapacity": 14,
    "boxSize": 3,
    "supplies": [
      [{"color": "orange", "count": 9}, {"color": "yellow", "count": 9}],
      [{"color": "blue", "count": 9}, {"color": "blue", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "green", "count": 9}],
      [{"color": "green", "count": 9}, {"color": "red", "count": 9}]
    ],
    "docks": [
      ["orange", "red", "blue", "red", "blue", "yellow", "blue", "green"],
      ["blue", "yellow", "green", "green", "orange", "orange", "blue", "red"],
      ["green", "yellow", "green", "blue", "red", "red", "green", "red"]
    ],
    "seals": [{"dock": 0, "after": {"dock": 1, "box": 0}}]
  },
  {
    "id": "board-111",
    "title": "The last tight lap",
    "beltCapacity": 14,
    "boxSize": 3,
    "supplies": [
      [{"color": "green", "count": 9}, {"color": "red", "count": 9}],
      [{"color": "yellow", "count": 9}, {"color": "yellow", "count": 9}],
      [{"color": "green", "count": 9}, {"color": "yellow", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "blue", "count": 9}]
    ],
    "docks": [
      ["green", "yellow", "blue", "red", "yellow", "green", "green", "yellow"],
      ["yellow", "red", "red", "red", "yellow", "yellow", "blue", "green"],
      ["red", "green", "yellow", "yellow", "yellow", "green", "blue", "red"]
    ]
  },
  {
    "id": "board-112",
    "title": "Back to the docks",
    "beltCapacity": 20,
    "boxSize": 3,
    "supplies": [
      [{"color": "yellow", "count": 9}, {"color": "blue", "count": 9}, {"color": "red", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "orange", "count": 9}, {"color": "yellow", "count": 9}],
      [{"color": "red", "count": 9}, {"color": "blue", "count": 9}, {"color": "green", "count": 9}]
    ],
    "docks": [
      ["yellow", "yellow", "blue", "yellow", "orange", "green", "red", "blue", "blue"],
      ["red", "blue", "red", "red", "yellow", "red", "orange", "red", "blue"],
      ["blue", "green", "yellow", "red", "yellow", "green", "red", "red", "orange"]
    ],
    "trackShape": "delta"
  }
];

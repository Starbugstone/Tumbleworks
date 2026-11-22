import type { TubeDef } from './types';

export const TUBE_ISLAND_BOARDS: readonly TubeDef[] = [
  {
    "kind": "tube",
    "id": "tube-94",
    "title": "The closing cup",
    "capacity": 4,
    "containers": [
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "cup", "capacity": 2}
    ],
    "tubes": [
      ["red", "green", "blue", "blue"],
      ["red", "blue", "green", "green"],
      ["red", "blue", "green", "red"],
      [],
      []
    ],
    "solution": [
      {"from": 0, "to": 3},
      {"from": 1, "to": 0},
      {"from": 1, "to": 3},
      {"from": 2, "to": 1},
      {"from": 1, "to": 4},
      {"from": 0, "to": 1},
      {"from": 2, "to": 1},
      {"from": 2, "to": 3},
      {"from": 0, "to": 2},
      {"from": 4, "to": 2}
    ]
  },
  {
    "kind": "tube",
    "id": "tube-95",
    "title": "No way back",
    "capacity": 4,
    "tubes": [
      ["yellow", "red", "yellow", "blue"],
      ["blue", "green", "blue", "green"],
      ["red", "yellow", "green", "yellow"],
      ["blue", "red", "green", "red"],
      []
    ],
    "solution": [
      {"from": 1, "to": 4},
      {"from": 0, "to": 1},
      {"from": 2, "to": 0},
      {"from": 2, "to": 4},
      {"from": 0, "to": 2},
      {"from": 3, "to": 0},
      {"from": 3, "to": 4},
      {"from": 0, "to": 3},
      {"from": 2, "to": 0},
      {"from": 3, "to": 2},
      {"from": 1, "to": 3},
      {"from": 1, "to": 4},
      {"from": 1, "to": 3}
    ],
    "rows": [2, 1, 2]
  },
  {
    "kind": "tube",
    "id": "tube-96",
    "title": "Spend it once",
    "capacity": 4,
    "containers": [
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "cup", "capacity": 2}
    ],
    "tubes": [
      ["red", "green", "red", "blue"],
      ["blue", "green", "red", "blue"],
      ["blue", "green", "green", "red"],
      [],
      []
    ],
    "solution": [
      {"from": 0, "to": 4},
      {"from": 1, "to": 4},
      {"from": 0, "to": 1},
      {"from": 0, "to": 3},
      {"from": 1, "to": 0},
      {"from": 1, "to": 3},
      {"from": 2, "to": 0},
      {"from": 2, "to": 3},
      {"from": 1, "to": 2},
      {"from": 4, "to": 2}
    ]
  },
  {
    "kind": "tube",
    "id": "tube-97",
    "title": "Wide and calm",
    "capacity": 4,
    "tubes": [
      ["red", "black", "green", "blue"],
      ["green", "yellow", "yellow", "orange"],
      ["yellow", "yellow", "black", "blue"],
      ["red", "black", "orange", "blue"],
      ["orange", "blue", "red", "orange"],
      ["black", "green", "green", "red"],
      []
    ],
    "solution": [
      {"from": 0, "to": 6},
      {"from": 2, "to": 6},
      {"from": 3, "to": 6},
      {"from": 4, "to": 3},
      {"from": 5, "to": 4},
      {"from": 0, "to": 5},
      {"from": 0, "to": 2},
      {"from": 4, "to": 0},
      {"from": 4, "to": 6},
      {"from": 1, "to": 4},
      {"from": 3, "to": 4},
      {"from": 2, "to": 3},
      {"from": 1, "to": 2},
      {"from": 5, "to": 1},
      {"from": 3, "to": 5},
      {"from": 0, "to": 3}
    ],
    "rows": [2, 3, 2]
  },
  {
    "kind": "tube",
    "id": "tube-98",
    "title": "Tight quarters",
    "capacity": 4,
    "tubes": [
      ["green", "yellow", "red", "yellow"],
      ["yellow", "blue", "green", "green"],
      ["blue", "yellow", "blue", "blue"],
      ["red", "red", "green", "red"],
      []
    ],
    "solution": [
      {"from": 1, "to": 4},
      {"from": 2, "to": 1},
      {"from": 0, "to": 2},
      {"from": 3, "to": 0},
      {"from": 3, "to": 4},
      {"from": 0, "to": 3},
      {"from": 2, "to": 0},
      {"from": 1, "to": 2},
      {"from": 0, "to": 1},
      {"from": 0, "to": 4}
    ]
  },
  {
    "kind": "tube",
    "id": "tube-99",
    "title": "Eight to tidy",
    "capacity": 4,
    "tubes": [
      ["yellow", "green", "black", "yellow"],
      ["blue", "green", "orange"],
      ["blue", "red", "black"],
      ["black", "blue"],
      ["green", "black", "orange", "orange"],
      ["yellow", "red"],
      ["yellow", "green", "red"],
      ["blue", "orange", "red"]
    ],
    "solution": [
      {"from": 5, "to": 6},
      {"from": 0, "to": 5},
      {"from": 2, "to": 0},
      {"from": 2, "to": 7},
      {"from": 2, "to": 3},
      {"from": 1, "to": 2},
      {"from": 4, "to": 2},
      {"from": 0, "to": 4},
      {"from": 0, "to": 1},
      {"from": 0, "to": 5},
      {"from": 6, "to": 0},
      {"from": 1, "to": 6},
      {"from": 1, "to": 3},
      {"from": 7, "to": 0},
      {"from": 7, "to": 2},
      {"from": 3, "to": 7},
      {"from": 4, "to": 3},
      {"from": 6, "to": 4},
      {"from": 5, "to": 6}
    ],
    "rows": [3, 3, 2]
  },
  {
    "kind": "tube",
    "id": "tube-100",
    "title": "Six colours, one gap",
    "capacity": 4,
    "tubes": [
      ["green", "yellow", "red", "green"],
      ["orange", "blue", "black", "orange"],
      ["yellow", "green", "black", "red"],
      ["green", "orange", "blue", "red"],
      ["black", "yellow", "black", "blue"],
      ["blue", "orange", "yellow", "red"],
      []
    ],
    "solution": [
      {"from": 2, "to": 6},
      {"from": 3, "to": 6},
      {"from": 4, "to": 3},
      {"from": 4, "to": 2},
      {"from": 5, "to": 6},
      {"from": 4, "to": 5},
      {"from": 2, "to": 4},
      {"from": 0, "to": 2},
      {"from": 0, "to": 6},
      {"from": 5, "to": 0},
      {"from": 1, "to": 5},
      {"from": 1, "to": 4},
      {"from": 3, "to": 1},
      {"from": 5, "to": 3},
      {"from": 1, "to": 5},
      {"from": 3, "to": 1},
      {"from": 2, "to": 3},
      {"from": 0, "to": 2},
      {"from": 0, "to": 3}
    ],
    "rows": [2, 3, 2]
  },
  {
    "kind": "tube",
    "id": "tube-101",
    "title": "Under the cap again",
    "capacity": 5,
    "containers": [
      {"role": "ordinary", "capacity": 5},
      {"role": "ordinary", "capacity": 5},
      {"role": "ordinary", "capacity": 5},
      {"role": "ordinary", "capacity": 5},
      {"role": "ordinary", "capacity": 5},
      {"role": "capped", "capacity": 5, "opensOn": "red"}
    ],
    "tubes": [
      ["blue", "blue", "red", "green", "green"],
      ["yellow", "yellow", "blue", "blue", "blue"],
      ["green", "green", "red", "red", "green"],
      ["yellow", "red", "yellow", "yellow", "red"],
      [],
      []
    ],
    "solution": [
      {"from": 0, "to": 4},
      {"from": 2, "to": 4},
      {"from": 2, "to": 0},
      {"from": 2, "to": 4},
      {"from": 0, "to": 2},
      {"from": 1, "to": 0},
      {"from": 3, "to": 2},
      {"from": 3, "to": 1},
      {"from": 3, "to": 2},
      {"from": 1, "to": 3}
    ]
  },
  {
    "kind": "tube",
    "id": "tube-102",
    "title": "A breather",
    "capacity": 5,
    "tubes": [
      ["black", "red", "red", "orange", "red"],
      ["black", "red", "black", "black", "green"],
      ["yellow", "orange", "orange", "green", "green"],
      ["yellow", "yellow", "green", "yellow", "orange"],
      ["orange", "green", "yellow", "red", "black"],
      []
    ],
    "solution": [
      {"from": 1, "to": 5},
      {"from": 2, "to": 5},
      {"from": 3, "to": 2},
      {"from": 4, "to": 1},
      {"from": 0, "to": 4},
      {"from": 0, "to": 2},
      {"from": 4, "to": 0},
      {"from": 3, "to": 4},
      {"from": 3, "to": 5},
      {"from": 4, "to": 3},
      {"from": 4, "to": 5},
      {"from": 2, "to": 4},
      {"from": 2, "to": 3},
      {"from": 0, "to": 2},
      {"from": 1, "to": 0},
      {"from": 1, "to": 2},
      {"from": 0, "to": 1}
    ]
  },
  {
    "kind": "tube",
    "id": "tube-103",
    "title": "Four and a cup",
    "capacity": 4,
    "containers": [
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "cup", "capacity": 2}
    ],
    "tubes": [
      ["blue", "blue", "red", "red"],
      ["green", "yellow", "blue", "blue"],
      ["green", "yellow", "yellow", "red"],
      ["green", "green", "yellow", "red"],
      [],
      []
    ],
    "solution": [
      {"from": 0, "to": 4},
      {"from": 1, "to": 0},
      {"from": 2, "to": 4},
      {"from": 1, "to": 2},
      {"from": 3, "to": 4},
      {"from": 1, "to": 5},
      {"from": 2, "to": 1},
      {"from": 2, "to": 5},
      {"from": 3, "to": 1},
      {"from": 5, "to": 3}
    ]
  },
  {
    "kind": "tube",
    "id": "tube-104",
    "title": "Thirty to sort",
    "capacity": 6,
    "tubes": [
      ["yellow", "yellow", "yellow", "yellow", "green", "yellow"],
      ["yellow", "green", "red", "green", "blue", "green"],
      ["green", "red", "orange", "orange", "red", "red"],
      ["orange", "blue", "orange", "green", "blue", "orange"],
      ["blue", "orange", "blue", "red", "blue", "red"],
      []
    ],
    "solution": [
      {"from": 2, "to": 5},
      {"from": 3, "to": 2},
      {"from": 4, "to": 5},
      {"from": 4, "to": 3},
      {"from": 4, "to": 5},
      {"from": 3, "to": 4},
      {"from": 1, "to": 3},
      {"from": 1, "to": 4},
      {"from": 1, "to": 3},
      {"from": 1, "to": 5},
      {"from": 3, "to": 1},
      {"from": 2, "to": 3},
      {"from": 2, "to": 5},
      {"from": 1, "to": 2},
      {"from": 0, "to": 1},
      {"from": 0, "to": 2},
      {"from": 0, "to": 1},
      {"from": 3, "to": 0},
      {"from": 4, "to": 3},
      {"from": 4, "to": 0},
      {"from": 3, "to": 4},
      {"from": 0, "to": 3}
    ]
  },
  {
    "kind": "tube",
    "id": "tube-105",
    "title": "Five and no slack",
    "capacity": 4,
    "tubes": [
      ["orange", "blue", "green", "yellow"],
      ["green", "red", "orange", "green"],
      ["blue", "green", "red", "orange"],
      ["orange", "yellow", "red", "blue"],
      ["yellow", "blue", "yellow", "red"],
      []
    ],
    "solution": [
      {"from": 4, "to": 5},
      {"from": 0, "to": 4},
      {"from": 1, "to": 0},
      {"from": 2, "to": 1},
      {"from": 2, "to": 5},
      {"from": 0, "to": 2},
      {"from": 3, "to": 0},
      {"from": 3, "to": 5},
      {"from": 4, "to": 3},
      {"from": 0, "to": 4},
      {"from": 1, "to": 0},
      {"from": 1, "to": 5},
      {"from": 2, "to": 1},
      {"from": 4, "to": 2},
      {"from": 3, "to": 4},
      {"from": 0, "to": 3}
    ]
  },
  {
    "kind": "tube",
    "id": "tube-106",
    "title": "Four tall stacks",
    "capacity": 6,
    "tubes": [
      ["yellow", "yellow", "yellow", "red", "yellow", "red"],
      ["red", "green", "blue", "blue", "green", "blue"],
      ["yellow", "green", "red", "blue", "blue", "blue"],
      ["green", "green", "red", "yellow", "green", "red"],
      []
    ],
    "solution": [
      {"from": 1, "to": 4},
      {"from": 2, "to": 4},
      {"from": 0, "to": 2},
      {"from": 3, "to": 2},
      {"from": 1, "to": 3},
      {"from": 1, "to": 4},
      {"from": 3, "to": 1},
      {"from": 3, "to": 0},
      {"from": 2, "to": 3},
      {"from": 1, "to": 2},
      {"from": 3, "to": 1},
      {"from": 2, "to": 3},
      {"from": 0, "to": 2},
      {"from": 0, "to": 1},
      {"from": 0, "to": 2}
    ]
  },
  {
    "kind": "tube",
    "id": "tube-107",
    "title": "Catch your breath",
    "capacity": 4,
    "tubes": [
      ["yellow", "red", "red", "blue"],
      ["red", "black", "yellow", "blue"],
      ["blue", "blue", "black", "red"],
      ["yellow", "black", "yellow", "black"],
      []
    ],
    "solution": [
      {"from": 0, "to": 4},
      {"from": 1, "to": 4},
      {"from": 2, "to": 0},
      {"from": 3, "to": 2},
      {"from": 1, "to": 3},
      {"from": 2, "to": 1},
      {"from": 2, "to": 4},
      {"from": 1, "to": 2},
      {"from": 0, "to": 1},
      {"from": 3, "to": 0},
      {"from": 3, "to": 2},
      {"from": 0, "to": 3}
    ],
    "rows": [1, 2, 2]
  },
  {
    "kind": "tube",
    "id": "tube-108",
    "title": "The patient cap",
    "capacity": 5,
    "tubes": [
      ["green", "green", "blue", "red", "blue"],
      ["green", "blue", "green", "red", "green"],
      ["blue", "red", "red", "blue", "red"],
      [],
      []
    ],
    "solution": [
      {"from": 2, "to": 3},
      {"from": 0, "to": 2},
      {"from": 0, "to": 3},
      {"from": 2, "to": 0},
      {"from": 2, "to": 3},
      {"from": 0, "to": 2},
      {"from": 1, "to": 0},
      {"from": 1, "to": 3},
      {"from": 1, "to": 0},
      {"from": 1, "to": 2},
      {"from": 0, "to": 1}
    ],
    "containers": [
      {"role": "ordinary", "capacity": 5},
      {"role": "ordinary", "capacity": 5},
      {"role": "ordinary", "capacity": 5},
      {"role": "ordinary", "capacity": 5},
      {"role": "capped", "capacity": 5, "opensOn": "red"}
    ]
  },
  {
    "kind": "tube",
    "id": "tube-109",
    "title": "Cup and cap",
    "capacity": 4,
    "containers": [
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "ordinary", "capacity": 4},
      {"role": "cup", "capacity": 2},
      {"role": "capped", "capacity": 4, "opensOn": "blue"}
    ],
    "tubes": [
      ["green", "blue", "blue", "blue"],
      ["yellow", "blue", "yellow", "green"],
      ["yellow", "red", "red", "green"],
      ["yellow", "red", "green", "red"],
      [],
      [],
      []
    ],
    "solution": [
      {"from": 0, "to": 4},
      {"from": 1, "to": 0},
      {"from": 2, "to": 0},
      {"from": 3, "to": 2},
      {"from": 3, "to": 0},
      {"from": 1, "to": 5},
      {"from": 1, "to": 4},
      {"from": 1, "to": 5},
      {"from": 2, "to": 1},
      {"from": 3, "to": 1},
      {"from": 2, "to": 3},
      {"from": 5, "to": 3}
    ],
    "rows": [2, 3, 2]
  },
  {
    "kind": "tube",
    "id": "tube-110",
    "title": "Six by five",
    "capacity": 5,
    "tubes": [
      ["black", "yellow", "blue", "orange", "black"],
      ["red", "blue", "yellow", "yellow", "red"],
      ["red", "black", "blue", "orange", "green"],
      ["yellow", "yellow", "black", "green", "green"],
      ["blue", "blue", "red", "orange", "black"],
      ["orange", "green", "green", "orange", "red"],
      []
    ],
    "solution": [
      {"from": 2, "to": 6},
      {"from": 3, "to": 6},
      {"from": 0, "to": 3},
      {"from": 4, "to": 3},
      {"from": 4, "to": 0},
      {"from": 1, "to": 4},
      {"from": 5, "to": 4},
      {"from": 5, "to": 2},
      {"from": 5, "to": 6},
      {"from": 0, "to": 5},
      {"from": 2, "to": 5},
      {"from": 0, "to": 2},
      {"from": 0, "to": 1},
      {"from": 3, "to": 0},
      {"from": 1, "to": 3},
      {"from": 1, "to": 2},
      {"from": 4, "to": 1},
      {"from": 2, "to": 4},
      {"from": 2, "to": 0},
      {"from": 1, "to": 2}
    ],
    "rows": [2, 3, 2]
  },
  {
    "kind": "tube",
    "id": "tube-111",
    "title": "Tall tubes, small cup",
    "capacity": 5,
    "containers": [
      {"role": "ordinary", "capacity": 5},
      {"role": "ordinary", "capacity": 5},
      {"role": "ordinary", "capacity": 5},
      {"role": "ordinary", "capacity": 5},
      {"role": "cup", "capacity": 2}
    ],
    "tubes": [
      ["red", "green", "blue", "blue", "blue"],
      ["green", "blue", "green", "red", "green"],
      ["red", "blue", "green", "red", "red"],
      [],
      []
    ],
    "solution": [
      {"from": 0, "to": 3},
      {"from": 1, "to": 0},
      {"from": 0, "to": 4},
      {"from": 1, "to": 0},
      {"from": 2, "to": 0},
      {"from": 1, "to": 2},
      {"from": 1, "to": 3},
      {"from": 2, "to": 1},
      {"from": 2, "to": 3},
      {"from": 0, "to": 2},
      {"from": 4, "to": 1}
    ]
  },
  {
    "kind": "tube",
    "id": "tube-112",
    "title": "Before the last",
    "capacity": 4,
    "tubes": [
      ["green", "blue"],
      ["blue", "orange"],
      ["black", "yellow", "orange", "red"],
      ["blue", "black"],
      ["black", "orange", "blue", "yellow"],
      ["green", "yellow", "yellow", "green"],
      ["black", "red", "red"],
      ["green", "orange", "red"]
    ],
    "solution": [
      {"from": 2, "to": 6},
      {"from": 1, "to": 2},
      {"from": 1, "to": 0},
      {"from": 2, "to": 1},
      {"from": 4, "to": 2},
      {"from": 4, "to": 0},
      {"from": 4, "to": 1},
      {"from": 4, "to": 3},
      {"from": 2, "to": 4},
      {"from": 2, "to": 3},
      {"from": 6, "to": 2},
      {"from": 3, "to": 6},
      {"from": 0, "to": 3},
      {"from": 5, "to": 0},
      {"from": 5, "to": 4},
      {"from": 0, "to": 5},
      {"from": 7, "to": 2},
      {"from": 7, "to": 1},
      {"from": 5, "to": 7}
    ],
    "rows": [3, 3, 2]
  },
  {
    "kind": "tube",
    "id": "tube-113",
    "title": "Beyond the eighty",
    "capacity": 6,
    "tubes": [
      ["green", "red", "yellow", "orange", "blue", "blue"],
      ["yellow", "green", "green", "orange", "red", "blue"],
      ["blue", "red", "blue", "yellow", "yellow", "orange"],
      ["green", "yellow", "orange", "red", "yellow", "orange"],
      ["red", "green", "green", "orange", "blue", "red"],
      []
    ],
    "solution": [
      {"from": 0, "to": 5},
      {"from": 1, "to": 5},
      {"from": 2, "to": 0},
      {"from": 4, "to": 1},
      {"from": 4, "to": 5},
      {"from": 0, "to": 4},
      {"from": 2, "to": 0},
      {"from": 2, "to": 5},
      {"from": 1, "to": 2},
      {"from": 3, "to": 1},
      {"from": 3, "to": 0},
      {"from": 3, "to": 2},
      {"from": 3, "to": 1},
      {"from": 0, "to": 3},
      {"from": 2, "to": 0},
      {"from": 2, "to": 5},
      {"from": 1, "to": 2},
      {"from": 4, "to": 2},
      {"from": 1, "to": 4},
      {"from": 3, "to": 1},
      {"from": 4, "to": 3},
      {"from": 0, "to": 4},
      {"from": 0, "to": 3}
    ]
  }
];

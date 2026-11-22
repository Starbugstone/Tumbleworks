import type { LoopBoardDef } from './types';

export const LOOP_ISLAND_BOARDS: readonly LoopBoardDef[] = [
  {
    "id": "loop-97",
    "title": "The little hauler",
    "loopCapacity": 22,
    "truckCapacity": 24,
    "lanes": [
      [
        {"capacity": 12, "segments": [{"color": "blue", "count": 2}, {"color": "red", "count": 6}]},
        {
          "segments": [{"color": "red", "count": 14}, {"color": "green", "count": 8}, {"color": "red", "count": 2}]
        }
      ],
      [
        {"segments": [{"color": "green", "count": 6}, {"color": "blue", "count": 18}]},
        {"segments": [{"color": "red", "count": 16}, {"color": "green", "count": 6}]}
      ],
      [
        {
          "segments": [{"color": "blue", "count": 4}, {"color": "green", "count": 4}, {"color": "red", "count": 4}]
        }
      ]
    ],
    "loop": [{"color": "red", "count": 18}]
  },
  {
    "id": "loop-98",
    "title": "The crossing",
    "loopCapacity": 20,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "segments": [{"color": "red", "count": 2}, {"color": "yellow", "count": 2}, {"color": "green", "count": 14}]
        },
        {"segments": [{"color": "red", "count": 16}, {"color": "yellow", "count": 8}]}
      ],
      [
        {
          "segments": [{"color": "yellow", "count": 2}, {"color": "red", "count": 4}, {"color": "blue", "count": 6}]
        },
        {"segments": [{"color": "yellow", "count": 4}, {"color": "red", "count": 20}]}
      ],
      [
        {
          "segments": [{"color": "red", "count": 4}, {"color": "yellow", "count": 2}, {"color": "red", "count": 18}]
        },
        {
          "segments": [{"color": "green", "count": 10}, {"color": "yellow", "count": 6}, {"color": "red", "count": 8}]
        }
      ]
    ],
    "loop": [{"color": "blue", "count": 18}],
    "trackShape": "eight"
  },
  {
    "id": "loop-99",
    "title": "Freight lane",
    "loopCapacity": 34,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "segments": [{"color": "yellow", "count": 12}, {"color": "green", "count": 2}, {"color": "red", "count": 4}]
        },
        {"segments": [{"color": "blue", "count": 14}]}
      ],
      [
        {
          "segments": [{"color": "green", "count": 10}, {"color": "blue", "count": 10}, {"color": "green", "count": 4}]
        },
        {"segments": [{"color": "blue", "count": 12}, {"color": "yellow", "count": 12}]}
      ],
      [
        {
          "segments": [{"color": "blue", "count": 10}, {"color": "green", "count": 8}, {"color": "red", "count": 6}]
        },
        {"segments": [{"color": "red", "count": 20}, {"color": "blue", "count": 2}]}
      ]
    ],
    "loop": [{"color": "red", "count": 18}]
  },
  {
    "id": "loop-100",
    "title": "Dockside shuffle",
    "loopCapacity": 28,
    "truckCapacity": 24,
    "lanes": [
      [
        {"segments": [{"color": "black", "count": 22}, {"color": "blue", "count": 2}]},
        {"segments": [{"color": "green", "count": 2}, {"color": "red", "count": 22}]}
      ],
      [
        {
          "segments": [{"color": "red", "count": 6}, {"color": "blue", "count": 16}, {"color": "black", "count": 2}]
        },
        {
          "segments": [{"color": "green", "count": 2}, {"color": "red", "count": 16}, {"color": "black", "count": 2}]
        }
      ],
      [
        {
          "segments": [{"color": "green", "count": 2}, {"color": "red", "count": 2}, {"color": "green", "count": 18}]
        },
        {"segments": [{"color": "black", "count": 22}, {"color": "red", "count": 2}]}
      ]
    ],
    "loop": [{"color": "blue", "count": 6}],
    "trackShape": "kidney"
  },
  {
    "id": "loop-101",
    "title": "Port of call",
    "loopCapacity": 24,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "segments": [{"color": "red", "count": 2}, {"color": "blue", "count": 8}, {"color": "red", "count": 12}]
        },
        {
          "segments": [{"color": "red", "count": 8}, {"color": "green", "count": 8}, {"color": "blue", "count": 8}]
        }
      ],
      [
        {
          "segments": [{"color": "red", "count": 2}, {"color": "blue", "count": 4}, {"color": "red", "count": 18}]
        },
        {"segments": [{"color": "green", "count": 8}, {"color": "red", "count": 16}]}
      ],
      [
        {
          "segments": [{"color": "red", "count": 2}, {"color": "blue", "count": 4}, {"color": "green", "count": 8}],
          "pourAfter": "1:0"
        }
      ]
    ],
    "loop": [{"color": "red", "count": 12}]
  },
  {
    "id": "loop-102",
    "title": "Quay to quay",
    "loopCapacity": 26,
    "truckCapacity": 24,
    "lanes": [
      [
        {"segments": [{"color": "blue", "count": 2}, {"color": "orange", "count": 12}]},
        {"segments": [{"color": "orange", "count": 22}, {"color": "green", "count": 2}]},
        {"segments": [{"color": "yellow", "count": 22}]}
      ],
      [
        {"segments": [{"color": "green", "count": 2}, {"color": "orange", "count": 22}]},
        {"segments": [{"color": "orange", "count": 2}, {"color": "red", "count": 22}]},
        {"segments": [{"color": "red", "count": 4}, {"color": "blue", "count": 20}]}
      ],
      [
        {
          "segments": [{"color": "yellow", "count": 2}, {"color": "green", "count": 20}, {"color": "orange", "count": 2}]
        },
        {
          "segments": [{"color": "red", "count": 2}, {"color": "blue", "count": 2}, {"color": "red", "count": 20}]
        }
      ]
    ],
    "loop": [{"color": "orange", "count": 12}],
    "trackShape": "delta"
  },
  {
    "id": "loop-103",
    "title": "Ferry break",
    "loopCapacity": 30,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "segments": [{"color": "red", "count": 16}, {"color": "yellow", "count": 6}, {"color": "red", "count": 2}]
        },
        {"segments": [{"color": "yellow", "count": 2}, {"color": "green", "count": 22}]}
      ],
      [
        {
          "segments": [{"color": "orange", "count": 2}, {"color": "red", "count": 14}, {"color": "yellow", "count": 4}]
        },
        {"segments": [{"color": "blue", "count": 14}, {"color": "orange", "count": 10}]}
      ],
      [
        {
          "segments": [{"color": "green", "count": 2}, {"color": "orange", "count": 2}, {"color": "red", "count": 16}]
        },
        {
          "segments": [{"color": "yellow", "count": 2}, {"color": "orange", "count": 10}, {"color": "blue", "count": 10}]
        }
      ]
    ],
    "loop": [{"color": "yellow", "count": 10}]
  },
  {
    "id": "loop-104",
    "title": "Island express",
    "loopCapacity": 24,
    "truckCapacity": 24,
    "lanes": [
      [
        {"segments": [{"color": "red", "count": 18}, {"color": "green", "count": 6}]},
        {"segments": [{"color": "red", "count": 2}, {"color": "blue", "count": 22}]},
        {"segments": [{"color": "green", "count": 8}, {"color": "orange", "count": 16}]}
      ],
      [
        {
          "segments": [{"color": "red", "count": 2}, {"color": "blue", "count": 2}, {"color": "yellow", "count": 20}]
        },
        {
          "segments": [{"color": "red", "count": 2}, {"color": "orange", "count": 4}, {"color": "green", "count": 16}]
        }
      ],
      [
        {
          "segments": [{"color": "orange", "count": 4}, {"color": "green", "count": 16}, {"color": "red", "count": 4}]
        },
        {"segments": [{"color": "yellow", "count": 4}, {"color": "red", "count": 20}]}
      ]
    ],
    "loop": [{"color": "green", "count": 2}]
  },
  {
    "id": "loop-105",
    "title": "The harbour bridge",
    "loopCapacity": 24,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "segments": [{"color": "red", "count": 6}, {"color": "yellow", "count": 4}, {"color": "orange", "count": 10}]
        },
        {"segments": [{"color": "red", "count": 20}]},
        {
          "segments": [{"color": "green", "count": 2}, {"color": "red", "count": 2}, {"color": "blue", "count": 20}]
        }
      ],
      [
        {
          "segments": [{"color": "yellow", "count": 2}, {"color": "green", "count": 2}, {"color": "red", "count": 18}]
        },
        {
          "segments": [{"color": "blue", "count": 4}, {"color": "red", "count": 4}, {"color": "yellow", "count": 16}]
        }
      ],
      [
        {
          "segments": [{"color": "green", "count": 14}, {"color": "orange", "count": 2}, {"color": "green", "count": 6}]
        },
        {
          "segments": [{"color": "red", "count": 6}, {"color": "yellow", "count": 2}, {"color": "red", "count": 16}]
        }
      ]
    ],
    "loop": [{"color": "orange", "count": 12}],
    "trackShape": "eight"
  },
  {
    "id": "loop-106",
    "title": "The long haul",
    "loopCapacity": 24,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "segments": [{"color": "green", "count": 4}, {"color": "red", "count": 2}, {"color": "green", "count": 18}],
          "pourAfter": "2:0"
        },
        {"segments": [{"color": "red", "count": 12}, {"color": "blue", "count": 12}]}
      ],
      [
        {
          "segments": [{"color": "red", "count": 4}, {"color": "green", "count": 2}, {"color": "red", "count": 18}]
        },
        {"segments": [{"color": "blue", "count": 10}, {"color": "red", "count": 14}]}
      ],
      [
        {
          "segments": [{"color": "red", "count": 10}, {"color": "blue", "count": 2}, {"color": "red", "count": 12}]
        }
      ]
    ],
    "loop": []
  },
  {
    "id": "loop-107",
    "title": "Traffic island",
    "loopCapacity": 22,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "segments": [{"color": "blue", "count": 4}, {"color": "red", "count": 6}, {"color": "yellow", "count": 14}]
        },
        {"segments": [{"color": "blue", "count": 16}, {"color": "red", "count": 8}]}
      ],
      [
        {"segments": [{"color": "red", "count": 6}, {"color": "blue", "count": 14}]},
        {"segments": [{"color": "red", "count": 14}, {"color": "green", "count": 10}]}
      ],
      [
        {
          "segments": [{"color": "red", "count": 4}, {"color": "blue", "count": 6}, {"color": "red", "count": 4}]
        },
        {
          "segments": [{"color": "yellow", "count": 10}, {"color": "red", "count": 6}, {"color": "blue", "count": 8}]
        }
      ]
    ],
    "loop": [{"color": "green", "count": 14}]
  },
  {
    "id": "loop-108",
    "title": "A short bed at the quay",
    "loopCapacity": 20,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "segments": [{"color": "red", "count": 2}, {"color": "green", "count": 2}, {"color": "red", "count": 8}],
          "capacity": 12
        },
        {"segments": [{"color": "blue", "count": 2}, {"color": "red", "count": 6}]}
      ],
      [{"segments": [{"color": "red", "count": 4}, {"color": "blue", "count": 20}]}],
      [
        {
          "segments": [{"color": "green", "count": 2}, {"color": "blue", "count": 2}, {"color": "green", "count": 20}]
        }
      ]
    ],
    "loop": [{"color": "red", "count": 16}]
  },
  {
    "id": "loop-109",
    "title": "The coast road",
    "loopCapacity": 24,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "segments": [{"color": "green", "count": 4}, {"color": "orange", "count": 8}, {"color": "green", "count": 12}]
        },
        {"segments": [{"color": "red", "count": 22}]},
        {"segments": [{"color": "yellow", "count": 4}, {"color": "red", "count": 20}]}
      ],
      [
        {
          "segments": [{"color": "orange", "count": 4}, {"color": "green", "count": 8}, {"color": "blue", "count": 12}]
        },
        {"segments": [{"color": "blue", "count": 6}, {"color": "orange", "count": 12}]},
        {
          "segments": [{"color": "red", "count": 6}, {"color": "yellow", "count": 10}, {"color": "blue", "count": 8}]
        }
      ],
      [
        {
          "segments": [{"color": "yellow", "count": 2}, {"color": "blue", "count": 10}, {"color": "yellow", "count": 8}]
        }
      ]
    ],
    "loop": [{"color": "blue", "count": 12}],
    "trackShape": "kidney"
  },
  {
    "id": "loop-110",
    "title": "Harbour traffic",
    "loopCapacity": 32,
    "truckCapacity": 24,
    "lanes": [
      [
        {"segments": [{"color": "blue", "count": 2}, {"color": "red", "count": 22}]},
        {
          "segments": [{"color": "red", "count": 2}, {"color": "blue", "count": 2}, {"color": "orange", "count": 20}]
        },
        {
          "segments": [{"color": "green", "count": 6}, {"color": "blue", "count": 4}, {"color": "green", "count": 14}]
        }
      ],
      [
        {"segments": [{"color": "yellow", "count": 2}, {"color": "red", "count": 22}]},
        {
          "segments": [{"color": "blue", "count": 2}, {"color": "green", "count": 4}, {"color": "blue", "count": 14}]
        }
      ],
      [
        {"segments": [{"color": "orange", "count": 4}, {"color": "red", "count": 18}]},
        {"segments": [{"color": "red", "count": 2}, {"color": "yellow", "count": 22}]}
      ]
    ],
    "loop": [{"color": "red", "count": 6}]
  },
  {
    "id": "loop-111",
    "title": "Linked tailboards",
    "loopCapacity": 24,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "segments": [{"color": "red", "count": 4}, {"color": "blue", "count": 2}, {"color": "red", "count": 18}]
        },
        {"segments": [{"color": "blue", "count": 8}, {"color": "red", "count": 16}]}
      ],
      [
        {
          "segments": [{"color": "red", "count": 10}, {"color": "green", "count": 6}, {"color": "blue", "count": 8}]
        }
      ],
      [
        {
          "segments": [{"color": "red", "count": 10}, {"color": "blue", "count": 2}, {"color": "green", "count": 8}]
        }
      ],
      [
        {
          "segments": [{"color": "red", "count": 4}, {"color": "blue", "count": 4}, {"color": "red", "count": 10}]
        }
      ]
    ],
    "loop": [{"color": "green", "count": 10}],
    "couplings": [["0:0", "1:0"]]
  },
  {
    "id": "loop-112",
    "title": "Rush for the ferry",
    "loopCapacity": 22,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "segments": [{"color": "red", "count": 12}, {"color": "orange", "count": 4}, {"color": "blue", "count": 8}]
        },
        {"segments": [{"color": "green", "count": 4}, {"color": "orange", "count": 20}]},
        {"segments": [{"color": "red", "count": 6}, {"color": "green", "count": 18}]},
        {
          "segments": [{"color": "orange", "count": 10}, {"color": "red", "count": 8}, {"color": "yellow", "count": 6}]
        }
      ],
      [
        {
          "segments": [{"color": "red", "count": 4}, {"color": "green", "count": 6}, {"color": "red", "count": 10}]
        },
        {"segments": [{"color": "green", "count": 20}]},
        {"segments": [{"color": "blue", "count": 16}, {"color": "red", "count": 6}]}
      ],
      [
        {"segments": [{"color": "red", "count": 20}, {"color": "orange", "count": 4}]},
        {"segments": [{"color": "yellow", "count": 18}, {"color": "red", "count": 6}]}
      ]
    ],
    "loop": [{"color": "orange", "count": 10}]
  },
  {
    "id": "loop-113",
    "title": "The tandem run",
    "loopCapacity": 32,
    "truckCapacity": 24,
    "lanes": [
      [
        {"segments": [{"color": "green", "count": 2}, {"color": "red", "count": 22}]},
        {
          "segments": [{"color": "green", "count": 2}, {"color": "red", "count": 2}, {"color": "blue", "count": 20}]
        },
        {"segments": [{"color": "red", "count": 22}]},
        {"segments": [{"color": "green", "count": 16}, {"color": "red", "count": 8}]}
      ],
      [
        {
          "segments": [{"color": "red", "count": 4}, {"color": "green", "count": 14}, {"color": "blue", "count": 4}]
        },
        {"segments": [{"color": "red", "count": 2}, {"color": "green", "count": 22}]},
        {"segments": [{"color": "green", "count": 12}]}
      ],
      [
        {
          "segments": [{"color": "red", "count": 2}, {"color": "green", "count": 2}, {"color": "red", "count": 20}]
        },
        {
          "segments": [{"color": "blue", "count": 4}, {"color": "red", "count": 14}, {"color": "green", "count": 2}]
        }
      ]
    ],
    "loop": [{"color": "blue", "count": 20}],
    "couplings": [["0:0", "1:0"]]
  },
  {
    "id": "loop-114",
    "title": "The return trip",
    "loopCapacity": 30,
    "truckCapacity": 24,
    "lanes": [
      [
        {"segments": [{"color": "red", "count": 6}, {"color": "blue", "count": 18}]},
        {"segments": [{"color": "red", "count": 14}, {"color": "yellow", "count": 10}]}
      ],
      [
        {"segments": [{"color": "yellow", "count": 16}, {"color": "green", "count": 8}]},
        {"segments": [{"color": "yellow", "count": 4}, {"color": "red", "count": 20}]}
      ],
      [
        {
          "segments": [{"color": "yellow", "count": 14}, {"color": "green", "count": 2}, {"color": "yellow", "count": 4}]
        },
        {
          "segments": [{"color": "red", "count": 4}, {"color": "blue", "count": 6}, {"color": "red", "count": 4}]
        }
      ]
    ],
    "loop": [{"color": "green", "count": 14}]
  },
  {
    "id": "loop-115",
    "title": "The inlet shuttle",
    "loopCapacity": 24,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "capacity": 12,
          "segments": [{"color": "red", "count": 2}, {"color": "green", "count": 4}, {"color": "red", "count": 6}]
        },
        {"segments": [{"color": "red", "count": 10}]}
      ],
      [
        {
          "segments": [{"color": "green", "count": 4}, {"color": "red", "count": 14}, {"color": "blue", "count": 6}]
        },
        {"segments": [{"color": "red", "count": 14}, {"color": "green", "count": 6}]}
      ],
      [
        {
          "segments": [{"color": "red", "count": 8}, {"color": "green", "count": 10}, {"color": "red", "count": 6}]
        }
      ]
    ],
    "loop": [{"color": "blue", "count": 18}],
    "trackShape": "delta"
  },
  {
    "id": "loop-116",
    "title": "Convoy home",
    "loopCapacity": 20,
    "truckCapacity": 24,
    "lanes": [
      [
        {
          "segments": [{"color": "green", "count": 2}, {"color": "red", "count": 2}, {"color": "green", "count": 20}]
        },
        {"segments": [{"color": "red", "count": 20}, {"color": "blue", "count": 4}]}
      ],
      [
        {
          "segments": [{"color": "red", "count": 2}, {"color": "blue", "count": 2}, {"color": "red", "count": 20}]
        },
        {
          "segments": [{"color": "green", "count": 12}, {"color": "blue", "count": 8}, {"color": "red", "count": 4}]
        }
      ],
      [
        {"segments": [{"color": "green", "count": 22}]},
        {
          "segments": [{"color": "green", "count": 4}, {"color": "blue", "count": 6}, {"color": "red", "count": 14}]
        }
      ],
      [
        {
          "segments": [{"color": "red", "count": 10}, {"color": "blue", "count": 2}, {"color": "green", "count": 12}]
        }
      ]
    ],
    "loop": [{"color": "blue", "count": 2}],
    "couplings": [["0:0", "1:0"]]
  }
];

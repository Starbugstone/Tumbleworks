import type { LoopBoardDef } from './types';

/** Generated seed 30; independent win and causal jam retained in tests/variety-witnesses.ts. */
export const LOOP_210: LoopBoardDef = {
  "id": "loop-210",
  "title": "Small truck, big unlock",
  "loopCapacity": 24,
  "truckCapacity": 24,
  "lanes": [
    [
      {
        "capacity": 12,
        "segments": [
          {
            "color": "blue",
            "count": 8
          },
          {
            "color": "red",
            "count": 2
          }
        ]
      },
      {
        "segments": [
          {
            "color": "green",
            "count": 12
          },
          {
            "color": "blue",
            "count": 12
          }
        ]
      }
    ],
    [
      {
        "segments": [
          {
            "color": "red",
            "count": 22
          },
          {
            "color": "green",
            "count": 2
          }
        ],
        "pourAfter": "0:0"
      }
    ],
    [
      {
        "segments": [
          {
            "color": "red",
            "count": 10
          },
          {
            "color": "blue",
            "count": 4
          },
          {
            "color": "red",
            "count": 2
          }
        ]
      }
    ]
  ],
  "loop": [
    {
      "color": "green",
      "count": 10
    }
  ]
};

/** Generated seed 10; independent win and causal jam retained in tests/variety-witnesses.ts. */
export const LOOP_211: LoopBoardDef = {
  "id": "loop-211",
  "title": "One tap, unequal loads",
  "loopCapacity": 20,
  "truckCapacity": 24,
  "lanes": [
    [
      {
        "capacity": 12,
        "segments": [
          {
            "color": "green",
            "count": 2
          },
          {
            "color": "red",
            "count": 4
          }
        ]
      },
      {
        "segments": [
          {
            "color": "red",
            "count": 16
          },
          {
            "color": "green",
            "count": 8
          }
        ]
      }
    ],
    [
      {
        "segments": [
          {
            "color": "red",
            "count": 8
          },
          {
            "color": "blue",
            "count": 4
          },
          {
            "color": "red",
            "count": 6
          }
        ]
      }
    ],
    [
      {
        "segments": [
          {
            "color": "green",
            "count": 14
          },
          {
            "color": "red",
            "count": 2
          },
          {
            "color": "blue",
            "count": 6
          }
        ]
      }
    ]
  ],
  "loop": [
    {
      "color": "blue",
      "count": 14
    }
  ],
  "couplings": [
    [
      "0:0",
      "1:0"
    ]
  ]
};

export const LOOP_VARIETY_BOARDS: readonly LoopBoardDef[] = [LOOP_210, LOOP_211];

import type { LoopBoardDef } from '../../src/loop/types';

/** Congestion and queued replacements are covered independently of the gentler opening campaign. */
export const QUEUED_LOOP: LoopBoardDef = {
  id: 'queued-fixture', title: 'Queued truck fixture', truckCapacity: 24, loopCapacity: 12,
  lanes: [[{ segments: [{ color: 'red', count: 8 }, { color: 'blue', count: 16 }] }],
    [{ segments: [{ color: 'yellow', count: 12 }] }, { segments: [{ color: 'blue', count: 8 }, { color: 'red', count: 16 }] }]],
  loop: [{ color: 'yellow', count: 12 }],
};
export const CONGESTED_LOOP: LoopBoardDef = {
  id: 'congested-fixture', title: 'Congested fixture', truckCapacity: 24, loopCapacity: 24,
  lanes: [[{ segments: [{ color: 'green', count: 6 }, { color: 'blue', count: 18 }] }],
    [{ segments: [{ color: 'yellow', count: 8 }, { color: 'red', count: 10 }] }],
    [{ segments: [{ color: 'green', count: 12 }] }, { segments: [{ color: 'red', count: 6 }, { color: 'yellow', count: 12 }] }]],
  loop: [{ color: 'green', count: 6 }, { color: 'blue', count: 6 }, { color: 'red', count: 8 }, { color: 'yellow', count: 4 }],
};

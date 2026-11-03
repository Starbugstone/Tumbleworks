import type { TubeDef } from './types';

export const TUBE_BOARDS: readonly TubeDef[] = [
  {
    kind: 'tube', id: 'tube-1', title: 'A little room', capacity: 4,
    tubes: [
      ['red', 'red', 'blue', 'blue'],
      ['blue', 'blue', 'green', 'green'],
      ['green', 'green', 'red', 'red'], [], [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 2, to: 0 }, { from: 1, to: 2 }, { from: 1, to: 3 },
    ],
  },
  /** Four colours, two spares, a few moves: the first real sort. */
  {
    kind: 'tube', id: 'tube-2', title: 'Crossed currents', capacity: 4,
    tubes: [
      ['green', 'red', 'red', 'yellow'],
      ['yellow', 'yellow', 'green', 'green'],
      ['green', 'blue', 'blue', 'blue'],
      ['blue', 'yellow', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 3, to: 4 }, { from: 0, to: 3 }, { from: 0, to: 4 }, { from: 1, to: 0 },
      { from: 3, to: 1 }, { from: 2, to: 3 }, { from: 0, to: 2 },
    ],
  },
  /** Three colours and a single empty tube: the spare has to be used well. */
  {
    kind: 'tube', id: 'tube-3', title: 'One spare', capacity: 4,
    tubes: [
      ['green', 'red', 'green', 'blue'],
      ['green', 'blue', 'red', 'red'],
      ['blue', 'blue', 'green', 'red'],
      [],
    ],
    solution: [
      { from: 1, to: 3 }, { from: 0, to: 1 }, { from: 2, to: 3 }, { from: 0, to: 2 },
      { from: 0, to: 3 }, { from: 2, to: 0 }, { from: 1, to: 2 }, { from: 0, to: 1 },
    ],
  },
  /** Three colours five high with two spares: the groups are bigger. */
  {
    kind: 'tube', id: 'tube-4', title: 'Taller tubes', capacity: 5,
    tubes: [
      ['blue', 'blue', 'red', 'green', 'green'],
      ['blue', 'red', 'green', 'green', 'red'],
      ['green', 'blue', 'blue', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 1, to: 0 }, { from: 1, to: 3 }, { from: 0, to: 1 },
      { from: 1, to: 4 }, { from: 0, to: 1 }, { from: 2, to: 4 }, { from: 2, to: 1 },
      { from: 2, to: 3 },
    ],
  },
  /** Four colours, one empty tube, five high. */
  {
    kind: 'tube', id: 'tube-5', title: 'One spare, five high', capacity: 5,
    tubes: [
      ['red', 'blue', 'blue', 'green', 'yellow'],
      ['yellow', 'yellow', 'blue', 'red', 'green'],
      ['green', 'green', 'yellow', 'yellow', 'red'],
      ['blue', 'blue', 'green', 'red', 'red'],
      [],
    ],
    solution: [
      { from: 2, to: 4 }, { from: 0, to: 2 }, { from: 1, to: 0 }, { from: 1, to: 4 },
      { from: 3, to: 4 }, { from: 0, to: 3 }, { from: 1, to: 0 }, { from: 2, to: 1 },
      { from: 3, to: 2 }, { from: 0, to: 3 }, { from: 0, to: 4 },
    ],
  },
  /** Orange and its cross pattern arrive here, in the calmest game, before the belts see them. */
  {
    kind: 'tube', id: 'tube-6', title: 'A fifth colour', capacity: 4,
    tubes: [
      ['blue', 'green', 'green', 'orange'],
      ['green', 'yellow', 'blue', 'blue'],
      ['green', 'orange', 'blue', 'yellow'],
      ['yellow', 'red', 'red', 'yellow'],
      ['orange', 'orange', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 1, to: 5 }, { from: 2, to: 1 }, { from: 2, to: 5 }, { from: 0, to: 2 },
      { from: 3, to: 1 }, { from: 3, to: 6 }, { from: 1, to: 3 }, { from: 0, to: 1 },
      { from: 0, to: 5 }, { from: 4, to: 6 }, { from: 2, to: 4 }, { from: 1, to: 2 },
    ],
  },
  /** Five colours, five high, two spares. */
  {
    kind: 'tube', id: 'tube-7', title: 'Five by five', capacity: 5,
    tubes: [
      ['blue', 'yellow', 'red', 'yellow', 'green'],
      ['blue', 'orange', 'orange', 'orange', 'green'],
      ['blue', 'blue', 'red', 'red', 'orange'],
      ['yellow', 'yellow', 'yellow', 'green', 'green'],
      ['green', 'blue', 'orange', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 2, to: 5 }, { from: 2, to: 6 }, { from: 4, to: 6 }, { from: 4, to: 5 },
      { from: 4, to: 2 }, { from: 0, to: 4 }, { from: 1, to: 4 }, { from: 1, to: 5 },
      { from: 1, to: 2 }, { from: 3, to: 4 }, { from: 0, to: 3 }, { from: 0, to: 6 },
      { from: 0, to: 3 }, { from: 0, to: 2 },
    ],
  },
  /** Four colours spread over five part-full tubes: more room, more ways to waste it. */
  {
    kind: 'tube', id: 'tube-8', title: 'Loose fill', capacity: 4,
    tubes: [
      ['yellow', 'blue', 'green'],
      ['red', 'blue'],
      ['yellow', 'green', 'yellow', 'green'],
      ['yellow', 'red', 'blue', 'blue'],
      ['green', 'red', 'red'],
      [],
    ],
    solution: [
      { from: 2, to: 0 }, { from: 3, to: 1 }, { from: 3, to: 4 }, { from: 2, to: 3 },
      { from: 0, to: 2 }, { from: 0, to: 5 }, { from: 0, to: 3 }, { from: 1, to: 5 },
      { from: 4, to: 1 }, { from: 2, to: 4 }, { from: 2, to: 3 },
    ],
  },
  /** Four colours five high with two spares. */
  {
    kind: 'tube', id: 'tube-9', title: 'Four, five, two', capacity: 5,
    tubes: [
      ['red', 'blue', 'blue', 'green', 'yellow'],
      ['yellow', 'yellow', 'blue', 'red', 'green'],
      ['green', 'green', 'yellow', 'yellow', 'red'],
      ['blue', 'blue', 'green', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 2, to: 4 }, { from: 0, to: 2 }, { from: 1, to: 0 }, { from: 1, to: 4 },
      { from: 3, to: 4 }, { from: 0, to: 3 }, { from: 1, to: 0 }, { from: 2, to: 1 },
      { from: 3, to: 2 }, { from: 0, to: 3 }, { from: 0, to: 4 },
    ],
  },
  /** Tubes of six for the first time, three colours. */
  {
    kind: 'tube', id: 'tube-10', title: 'Six high', capacity: 6,
    tubes: [
      ['blue', 'green', 'red', 'red', 'blue', 'red'],
      ['blue', 'red', 'blue', 'green', 'green', 'green'],
      ['green', 'blue', 'blue', 'green', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 2, to: 3 }, { from: 0, to: 4 }, { from: 0, to: 3 },
      { from: 1, to: 0 }, { from: 1, to: 4 }, { from: 1, to: 3 }, { from: 1, to: 4 },
      { from: 2, to: 0 }, { from: 2, to: 4 }, { from: 0, to: 2 }, { from: 0, to: 4 },
    ],
  },
  /** Four colours, four high, one spare: every move must earn its place. */
  {
    kind: 'tube', id: 'tube-11', title: 'No slack', capacity: 4,
    tubes: [
      ['yellow', 'blue', 'green', 'red'],
      ['blue', 'yellow', 'green', 'yellow'],
      ['green', 'yellow', 'red', 'blue'],
      ['blue', 'green', 'red', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 3, to: 4 }, { from: 0, to: 3 }, { from: 2, to: 0 },
      { from: 2, to: 4 }, { from: 1, to: 2 }, { from: 1, to: 3 }, { from: 1, to: 2 },
      { from: 0, to: 1 }, { from: 2, to: 0 }, { from: 3, to: 2 }, { from: 1, to: 3 },
    ],
  },
  /** Five colours spread over six part-full tubes. */
  {
    kind: 'tube', id: 'tube-12', title: 'Scattered', capacity: 4,
    tubes: [
      ['red', 'green', 'orange'],
      ['green', 'yellow', 'blue', 'yellow'],
      ['orange', 'orange', 'green', 'blue'],
      ['orange', 'blue', 'red', 'red'],
      ['green', 'blue'],
      ['yellow', 'yellow', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 2, to: 4 }, { from: 4, to: 6 }, { from: 2, to: 4 }, { from: 0, to: 2 },
      { from: 0, to: 4 }, { from: 3, to: 0 }, { from: 3, to: 6 }, { from: 2, to: 3 },
      { from: 5, to: 0 }, { from: 1, to: 5 }, { from: 1, to: 6 }, { from: 1, to: 5 },
      { from: 1, to: 4 },
    ],
  },
  /** Only three colours, one spare, but the groups run long. */
  {
    kind: 'tube', id: 'tube-13', title: 'Three colours, six high', capacity: 6,
    tubes: [
      ['green', 'blue', 'red', 'blue', 'red', 'green'],
      ['green', 'red', 'green', 'blue', 'blue', 'green'],
      ['blue', 'blue', 'red', 'red', 'green', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 1, to: 3 }, { from: 2, to: 0 }, { from: 2, to: 3 },
      { from: 0, to: 2 }, { from: 1, to: 0 }, { from: 3, to: 1 }, { from: 2, to: 3 },
      { from: 0, to: 2 }, { from: 0, to: 3 }, { from: 0, to: 2 }, { from: 1, to: 0 },
      { from: 1, to: 3 }, { from: 0, to: 1 },
    ],
  },
  /** Five colours and a single empty tube. */
  {
    kind: 'tube', id: 'tube-14', title: 'Five colours, one spare', capacity: 4,
    tubes: [
      ['yellow', 'orange', 'orange', 'green'],
      ['red', 'orange', 'green', 'red'],
      ['blue', 'yellow', 'green', 'yellow'],
      ['orange', 'red', 'yellow', 'green'],
      ['blue', 'blue', 'blue', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 5 }, { from: 3, to: 5 }, { from: 2, to: 3 }, { from: 2, to: 5 },
      { from: 3, to: 2 }, { from: 1, to: 3 }, { from: 1, to: 5 }, { from: 1, to: 0 },
      { from: 3, to: 1 }, { from: 0, to: 3 }, { from: 2, to: 0 }, { from: 4, to: 1 },
      { from: 2, to: 4 },
    ],
  },
  /** Four colours six high with two spares. */
  {
    kind: 'tube', id: 'tube-15', title: 'Four colours, six high', capacity: 6,
    tubes: [
      ['green', 'red', 'yellow', 'red', 'blue', 'blue'],
      ['yellow', 'red', 'blue', 'blue', 'red', 'green'],
      ['blue', 'green', 'red', 'green', 'green', 'blue'],
      ['yellow', 'yellow', 'yellow', 'yellow', 'green', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 2, to: 4 }, { from: 1, to: 2 }, { from: 0, to: 1 },
      { from: 1, to: 5 }, { from: 1, to: 4 }, { from: 1, to: 5 }, { from: 0, to: 1 },
      { from: 0, to: 5 }, { from: 2, to: 0 }, { from: 2, to: 5 }, { from: 2, to: 0 },
      { from: 2, to: 4 }, { from: 3, to: 5 }, { from: 3, to: 0 }, { from: 1, to: 3 },
    ],
  },
  /** Four colours five high spread over five tubes. */
  {
    kind: 'tube', id: 'tube-16', title: 'Spread thin', capacity: 5,
    tubes: [
      ['red', 'red', 'green', 'green', 'green'],
      ['green', 'blue', 'blue'],
      ['yellow', 'blue', 'yellow', 'green', 'yellow'],
      ['yellow', 'blue'],
      ['red', 'yellow', 'blue', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 1, to: 3 }, { from: 0, to: 1 }, { from: 4, to: 0 }, { from: 4, to: 3 },
      { from: 2, to: 4 }, { from: 2, to: 1 }, { from: 2, to: 4 }, { from: 2, to: 5 },
      { from: 2, to: 4 }, { from: 3, to: 5 }, { from: 4, to: 3 }, { from: 0, to: 4 },
    ],
  },
  /** Four colours, five high, one spare. */
  {
    kind: 'tube', id: 'tube-17', title: 'Four, five, one', capacity: 5,
    tubes: [
      ['green', 'yellow', 'yellow', 'green', 'red'],
      ['yellow', 'green', 'red', 'blue', 'green'],
      ['blue', 'green', 'yellow', 'red', 'yellow'],
      ['blue', 'blue', 'red', 'blue', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 1, to: 0 }, { from: 3, to: 4 }, { from: 1, to: 3 },
      { from: 1, to: 4 }, { from: 0, to: 1 }, { from: 2, to: 0 }, { from: 2, to: 4 },
      { from: 2, to: 0 }, { from: 1, to: 2 }, { from: 0, to: 1 }, { from: 2, to: 0 },
      { from: 3, to: 2 }, { from: 3, to: 4 }, { from: 2, to: 3 },
    ],
  },
  /** Five colours six high with two spares. */
  {
    kind: 'tube', id: 'tube-18', title: 'Thirty marbles', capacity: 6,
    tubes: [
      ['green', 'red', 'green', 'blue', 'yellow', 'green'],
      ['green', 'orange', 'blue', 'blue', 'orange', 'orange'],
      ['red', 'blue', 'blue', 'orange', 'orange', 'yellow'],
      ['red', 'orange', 'yellow', 'yellow', 'yellow', 'yellow'],
      ['green', 'green', 'blue', 'red', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 1, to: 5 }, { from: 1, to: 6 }, { from: 1, to: 5 }, { from: 0, to: 1 },
      { from: 2, to: 0 }, { from: 2, to: 5 }, { from: 2, to: 6 }, { from: 4, to: 2 },
      { from: 4, to: 6 }, { from: 1, to: 4 }, { from: 0, to: 1 }, { from: 0, to: 6 },
      { from: 0, to: 4 }, { from: 0, to: 2 }, { from: 0, to: 4 }, { from: 3, to: 1 },
      { from: 3, to: 5 }, { from: 2, to: 3 },
    ],
  },
  /** Five colours, five high, one spare. */
  {
    kind: 'tube', id: 'tube-19', title: 'Five and five', capacity: 5,
    tubes: [
      ['orange', 'orange', 'orange', 'green', 'green'],
      ['green', 'green', 'orange', 'orange', 'blue'],
      ['blue', 'red', 'green', 'blue', 'yellow'],
      ['blue', 'yellow', 'red', 'blue', 'yellow'],
      ['yellow', 'red', 'yellow', 'red', 'red'],
      [],
    ],
    solution: [
      { from: 4, to: 5 }, { from: 2, to: 4 }, { from: 3, to: 4 }, { from: 3, to: 2 },
      { from: 3, to: 5 }, { from: 4, to: 3 }, { from: 4, to: 5 }, { from: 3, to: 4 },
      { from: 1, to: 3 }, { from: 2, to: 3 }, { from: 0, to: 2 }, { from: 1, to: 0 },
      { from: 2, to: 1 }, { from: 2, to: 5 }, { from: 2, to: 3 },
    ],
  },
  /** Five colours loosely spread over six tubes with two spares. */
  {
    kind: 'tube', id: 'tube-20', title: 'Six tubes, five colours', capacity: 4,
    tubes: [
      ['green', 'yellow', 'red', 'yellow'],
      ['blue', 'green', 'green', 'blue'],
      ['red', 'orange'],
      ['red', 'orange', 'blue', 'green'],
      ['blue', 'orange', 'orange', 'yellow'],
      ['yellow', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 2, to: 6 }, { from: 5, to: 2 }, { from: 0, to: 5 }, { from: 0, to: 2 },
      { from: 0, to: 5 }, { from: 3, to: 0 }, { from: 1, to: 3 }, { from: 1, to: 0 },
      { from: 3, to: 1 }, { from: 3, to: 6 }, { from: 2, to: 3 }, { from: 4, to: 5 },
      { from: 4, to: 6 }, { from: 1, to: 4 },
    ],
  },
  /** Four colours six high and only one empty tube. */
  {
    kind: 'tube', id: 'tube-21', title: 'One spare, six high', capacity: 6,
    tubes: [
      ['yellow', 'green', 'blue', 'red', 'green', 'red'],
      ['yellow', 'red', 'green', 'green', 'green', 'blue'],
      ['yellow', 'blue', 'green', 'red', 'yellow', 'yellow'],
      ['blue', 'red', 'yellow', 'blue', 'blue', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 3, to: 4 }, { from: 1, to: 3 }, { from: 0, to: 1 },
      { from: 4, to: 0 }, { from: 1, to: 4 }, { from: 0, to: 1 }, { from: 3, to: 0 },
      { from: 2, to: 3 }, { from: 2, to: 1 }, { from: 2, to: 4 }, { from: 0, to: 2 },
      { from: 0, to: 4 }, { from: 0, to: 3 }, { from: 1, to: 0 }, { from: 3, to: 1 },
      { from: 3, to: 0 }, { from: 2, to: 3 }, { from: 1, to: 2 },
    ],
  },
  /** Five colours five high with two spares and a long shortest solution. */
  {
    kind: 'tube', id: 'tube-22', title: 'Long haul', capacity: 5,
    tubes: [
      ['blue', 'orange', 'red', 'yellow', 'blue'],
      ['green', 'red', 'orange', 'blue', 'yellow'],
      ['yellow', 'yellow', 'orange', 'blue', 'blue'],
      ['green', 'orange', 'green', 'orange', 'red'],
      ['green', 'green', 'yellow', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 3, to: 5 }, { from: 4, to: 5 }, { from: 1, to: 4 }, { from: 0, to: 1 },
      { from: 0, to: 4 }, { from: 0, to: 5 }, { from: 0, to: 3 }, { from: 1, to: 0 },
      { from: 2, to: 0 }, { from: 1, to: 2 }, { from: 1, to: 5 }, { from: 2, to: 6 },
      { from: 3, to: 6 }, { from: 1, to: 3 }, { from: 4, to: 2 }, { from: 3, to: 4 },
      { from: 3, to: 6 }, { from: 3, to: 4 },
    ],
  },
  /** Four colours spread over six part-full tubes with two spares. */
  {
    kind: 'tube', id: 'tube-23', title: 'Spread wide', capacity: 4,
    tubes: [
      ['green', 'green', 'blue'],
      ['green', 'blue'],
      ['green', 'blue', 'yellow', 'blue'],
      ['red', 'yellow'],
      ['red', 'yellow'],
      ['red', 'yellow', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 0, to: 1 }, { from: 2, to: 1 }, { from: 2, to: 3 }, { from: 3, to: 4 },
      { from: 3, to: 5 }, { from: 1, to: 3 }, { from: 0, to: 1 }, { from: 2, to: 3 },
      { from: 1, to: 2 }, { from: 4, to: 0 }, { from: 5, to: 4 }, { from: 5, to: 0 },
      { from: 4, to: 5 },
    ],
  },
  /** Five colours in a tight four-high rack with one spare. */
  {
    kind: 'tube', id: 'tube-24', title: 'Five colours, four high', capacity: 4,
    tubes: [
      ['orange', 'green', 'blue', 'yellow'],
      ['blue', 'orange', 'yellow', 'orange'],
      ['green', 'yellow', 'red', 'yellow'],
      ['blue', 'red', 'orange', 'green'],
      ['red', 'blue', 'green', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 5 }, { from: 2, to: 5 }, { from: 4, to: 2 }, { from: 3, to: 4 },
      { from: 1, to: 3 }, { from: 1, to: 5 }, { from: 3, to: 1 }, { from: 2, to: 3 },
      { from: 2, to: 5 }, { from: 4, to: 2 }, { from: 0, to: 4 }, { from: 0, to: 2 },
      { from: 1, to: 0 }, { from: 4, to: 1 }, { from: 3, to: 4 }, { from: 1, to: 3 },
    ],
  },
  /** Five colours six high with two spares and a long way round. */
  {
    kind: 'tube', id: 'tube-25', title: 'Tall and loose', capacity: 6,
    tubes: [
      ['orange', 'blue', 'green', 'green', 'green', 'orange'],
      ['green', 'yellow', 'yellow', 'yellow', 'blue', 'red'],
      ['red', 'red', 'yellow', 'blue', 'yellow', 'blue'],
      ['blue', 'red', 'red', 'yellow', 'orange', 'orange'],
      ['green', 'orange', 'orange', 'green', 'blue', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 0, to: 5 }, { from: 3, to: 5 }, { from: 3, to: 6 }, { from: 1, to: 3 },
      { from: 2, to: 1 }, { from: 2, to: 6 }, { from: 1, to: 2 }, { from: 1, to: 6 },
      { from: 0, to: 1 }, { from: 2, to: 0 }, { from: 2, to: 6 }, { from: 3, to: 2 },
      { from: 0, to: 3 }, { from: 0, to: 5 }, { from: 4, to: 2 }, { from: 4, to: 3 },
      { from: 4, to: 1 }, { from: 4, to: 5 }, { from: 1, to: 4 },
    ],
  },
  /** Three colours six high with one spare and a long solution. */
  {
    kind: 'tube', id: 'tube-26', title: 'Three colours, long way', capacity: 6,
    tubes: [
      ['red', 'blue', 'red', 'green', 'blue', 'red'],
      ['green', 'blue', 'green', 'blue', 'red', 'green'],
      ['green', 'blue', 'red', 'blue', 'green', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 2, to: 3 }, { from: 1, to: 2 }, { from: 1, to: 3 },
      { from: 0, to: 1 }, { from: 2, to: 0 }, { from: 1, to: 2 }, { from: 0, to: 1 },
      { from: 0, to: 3 }, { from: 2, to: 0 }, { from: 2, to: 3 }, { from: 0, to: 2 },
      { from: 0, to: 3 }, { from: 2, to: 0 }, { from: 1, to: 2 }, { from: 1, to: 0 },
      { from: 1, to: 2 },
    ],
  },
  /** Five colours five high, one spare. */
  {
    kind: 'tube', id: 'tube-27', title: 'Five high, no slack', capacity: 5,
    tubes: [
      ['orange', 'blue', 'green', 'red', 'yellow'],
      ['green', 'green', 'yellow', 'red', 'orange'],
      ['yellow', 'orange', 'green', 'blue', 'orange'],
      ['yellow', 'red', 'orange', 'yellow', 'blue'],
      ['blue', 'red', 'blue', 'green', 'red'],
      [],
    ],
    solution: [
      { from: 1, to: 5 }, { from: 2, to: 5 }, { from: 3, to: 2 }, { from: 0, to: 3 },
      { from: 1, to: 0 }, { from: 3, to: 1 }, { from: 3, to: 5 }, { from: 0, to: 3 },
      { from: 4, to: 3 }, { from: 4, to: 0 }, { from: 2, to: 4 }, { from: 2, to: 0 },
      { from: 5, to: 2 }, { from: 3, to: 5 }, { from: 1, to: 3 }, { from: 0, to: 1 },
      { from: 4, to: 0 }, { from: 4, to: 5 }, { from: 0, to: 4 }, { from: 2, to: 0 },
      { from: 2, to: 3 },
    ],
  },
  /** Five colours six high and only one empty tube. */
  {
    kind: 'tube', id: 'tube-28', title: 'One spare, five colours, six high', capacity: 6,
    tubes: [
      ['yellow', 'orange', 'green', 'blue', 'blue', 'green'],
      ['blue', 'red', 'red', 'yellow', 'red', 'orange'],
      ['green', 'red', 'blue', 'orange', 'orange', 'orange'],
      ['orange', 'yellow', 'green', 'yellow', 'red', 'yellow'],
      ['yellow', 'green', 'blue', 'green', 'blue', 'red'],
      [],
    ],
    solution: [
      { from: 1, to: 5 }, { from: 2, to: 5 }, { from: 4, to: 1 }, { from: 4, to: 2 },
      { from: 0, to: 4 }, { from: 0, to: 2 }, { from: 0, to: 4 }, { from: 5, to: 0 },
      { from: 1, to: 5 }, { from: 3, to: 1 }, { from: 3, to: 5 }, { from: 1, to: 3 },
      { from: 1, to: 5 }, { from: 2, to: 1 }, { from: 2, to: 5 }, { from: 4, to: 2 },
      { from: 4, to: 1 }, { from: 4, to: 2 }, { from: 3, to: 4 }, { from: 3, to: 2 },
      { from: 3, to: 4 }, { from: 0, to: 3 }, { from: 0, to: 4 },
    ],
  },
  /** Five colours six high, two spares, a long solution. */
  {
    kind: 'tube', id: 'tube-29', title: 'Thirty, two spares', capacity: 6,
    tubes: [
      ['orange', 'red', 'orange', 'blue', 'green', 'orange'],
      ['green', 'blue', 'red', 'yellow', 'orange', 'green'],
      ['orange', 'green', 'yellow', 'red', 'green', 'yellow'],
      ['blue', 'green', 'blue', 'red', 'orange', 'blue'],
      ['red', 'blue', 'yellow', 'yellow', 'yellow', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 0, to: 5 }, { from: 1, to: 0 }, { from: 1, to: 5 }, { from: 2, to: 1 },
      { from: 1, to: 6 }, { from: 4, to: 1 }, { from: 4, to: 6 }, { from: 3, to: 4 },
      { from: 3, to: 5 }, { from: 1, to: 3 }, { from: 1, to: 4 }, { from: 0, to: 1 },
      { from: 0, to: 4 }, { from: 0, to: 5 }, { from: 2, to: 1 }, { from: 2, to: 0 },
      { from: 2, to: 6 }, { from: 2, to: 1 }, { from: 2, to: 5 }, { from: 3, to: 0 },
      { from: 3, to: 4 }, { from: 3, to: 1 }, { from: 4, to: 3 }, { from: 0, to: 4 },
      { from: 0, to: 5 },
    ],
  },
  /** Five colours six high with one spare: the longest Tube Sort board. */
  {
    kind: 'tube', id: 'tube-30', title: 'Grand finale', capacity: 6,
    tubes: [
      ['orange', 'green', 'orange', 'blue', 'green', 'orange'],
      ['orange', 'orange', 'red', 'green', 'orange', 'blue'],
      ['blue', 'green', 'yellow', 'blue', 'green', 'yellow'],
      ['yellow', 'blue', 'yellow', 'red', 'blue', 'red'],
      ['green', 'yellow', 'red', 'red', 'yellow', 'red'],
      [],
    ],
    solution: [
      { from: 3, to: 5 }, { from: 1, to: 3 }, { from: 0, to: 1 }, { from: 4, to: 5 },
      { from: 2, to: 4 }, { from: 0, to: 2 }, { from: 3, to: 0 }, { from: 3, to: 5 },
      { from: 4, to: 3 }, { from: 4, to: 5 }, { from: 3, to: 4 }, { from: 0, to: 3 },
      { from: 1, to: 0 }, { from: 2, to: 1 }, { from: 2, to: 3 }, { from: 2, to: 4 },
      { from: 1, to: 2 }, { from: 1, to: 5 }, { from: 0, to: 1 }, { from: 2, to: 0 },
      { from: 3, to: 2 }, { from: 4, to: 3 }, { from: 0, to: 4 }, { from: 0, to: 1 },
    ],
  },
  // BEGIN first stretch
  /** A few moves with two spares. */
  {
    kind: 'tube', id: 'tube-31', title: 'Short shuffle', capacity: 4,
    tubes: [
      ['blue', 'blue', 'green', 'blue'],
      ['red', 'red', 'green', 'green'],
      ['green', 'blue', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 1, to: 3 }, { from: 2, to: 1 }, { from: 0, to: 2 }, { from: 0, to: 3 },
      { from: 2, to: 0 }, { from: 2, to: 3 },
    ],
  },
  /** Two spares, one colour has to wait. */
  {
    kind: 'tube', id: 'tube-32', title: 'Over and back', capacity: 4,
    tubes: [
      ['blue', 'green', 'green', 'blue'],
      ['green', 'green', 'red', 'red'],
      ['red', 'blue', 'blue', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 1, to: 3 }, { from: 2, to: 3 }, { from: 0, to: 2 }, { from: 0, to: 1 },
      { from: 2, to: 0 }, { from: 2, to: 3 },
    ],
  },
  /** More mixing, more choice, the same three colours. */
  {
    kind: 'tube', id: 'tube-33', title: 'More mixed up', capacity: 4,
    tubes: [
      ['red', 'red', 'green', 'blue'],
      ['blue', 'red', 'blue', 'green'],
      ['green', 'green', 'blue', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 1, to: 0 }, { from: 1, to: 3 }, { from: 2, to: 1 },
      { from: 2, to: 3 }, { from: 0, to: 2 }, { from: 1, to: 0 }, { from: 1, to: 3 },
    ],
  },
  /** Three colours as mixed as they get with two spares. */
  {
    kind: 'tube', id: 'tube-34', title: 'Ten moves away', capacity: 4,
    tubes: [
      ['blue', 'green', 'green', 'red'],
      ['blue', 'green', 'red', 'blue'],
      ['green', 'red', 'blue', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 2, to: 3 }, { from: 1, to: 2 }, { from: 1, to: 3 },
      { from: 0, to: 1 }, { from: 2, to: 0 }, { from: 2, to: 3 }, { from: 1, to: 2 },
      { from: 0, to: 1 },
    ],
  },
  /** Four colours and a long shortest sort. */
  {
    kind: 'tube', id: 'tube-35', title: 'Four, well mixed', capacity: 4,
    tubes: [
      ['yellow', 'red', 'blue', 'yellow'],
      ['green', 'blue', 'yellow', 'green'],
      ['red', 'yellow', 'green', 'blue'],
      ['red', 'green', 'blue', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 2, to: 4 }, { from: 1, to: 2 }, { from: 0, to: 1 }, { from: 0, to: 4 },
      { from: 3, to: 0 }, { from: 3, to: 4 }, { from: 2, to: 3 }, { from: 1, to: 2 },
      { from: 1, to: 4 }, { from: 3, to: 1 }, { from: 0, to: 3 }, { from: 2, to: 0 },
      { from: 2, to: 3 },
    ],
  },
  /** Four colours again, a shorter way through. */
  {
    kind: 'tube', id: 'tube-36', title: 'A long unpick', capacity: 4,
    tubes: [
      ['yellow', 'blue', 'green', 'red'],
      ['blue', 'yellow', 'green', 'yellow'],
      ['green', 'yellow', 'red', 'blue'],
      ['blue', 'green', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 3, to: 4 }, { from: 0, to: 3 }, { from: 2, to: 0 },
      { from: 2, to: 4 }, { from: 1, to: 2 }, { from: 1, to: 3 }, { from: 1, to: 2 },
      { from: 0, to: 1 }, { from: 2, to: 0 }, { from: 3, to: 2 }, { from: 1, to: 3 },
    ],
  },
  /** One spare again, and most ways of using it lose. */
  {
    kind: 'tube', id: 'tube-37', title: 'The narrow way', capacity: 4,
    tubes: [
      ['red', 'green', 'red', 'blue'],
      ['red', 'blue', 'green', 'blue'],
      ['green', 'blue', 'green', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 1, to: 3 }, { from: 2, to: 0 }, { from: 1, to: 2 },
      { from: 1, to: 3 }, { from: 0, to: 1 }, { from: 2, to: 0 }, { from: 2, to: 3 },
      { from: 0, to: 2 }, { from: 0, to: 1 },
    ],
  },
// END first stretch
];

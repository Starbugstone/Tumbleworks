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
  /** One empty tube: the first move you make can be the one that loses. */
  {
    kind: 'tube', id: 'tube-38', title: 'Only one spare', capacity: 4,
    tubes: [
      ['green', 'blue', 'blue', 'blue'],
      ['red', 'green', 'green', 'blue'],
      ['red', 'green', 'red', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 1, to: 3 }, { from: 1, to: 0 }, { from: 2, to: 1 },
      { from: 2, to: 0 }, { from: 1, to: 2 },
    ],
  },
  /** Three colours, one spare, several traps. */
  {
    kind: 'tube', id: 'tube-39', title: 'Careful with the spare', capacity: 4,
    tubes: [
      ['green', 'blue', 'blue', 'red'],
      ['blue', 'red', 'green', 'green'],
      ['green', 'blue', 'red', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 2, to: 3 }, { from: 0, to: 2 }, { from: 1, to: 0 },
      { from: 1, to: 3 }, { from: 2, to: 1 }, { from: 0, to: 2 },
    ],
  },
  /** Yellow and its star, with a single spare. */
  {
    kind: 'tube', id: 'tube-40', title: 'Four colours, one spare', capacity: 4,
    tubes: [
      ['green', 'red', 'blue', 'green'],
      ['red', 'red', 'green', 'yellow'],
      ['blue', 'blue', 'yellow', 'yellow'],
      ['blue', 'green', 'yellow', 'red'],
      [],
    ],
    solution: [
      { from: 1, to: 4 }, { from: 0, to: 1 }, { from: 2, to: 4 }, { from: 0, to: 2 },
      { from: 3, to: 0 }, { from: 3, to: 4 }, { from: 1, to: 3 }, { from: 0, to: 1 },
      { from: 3, to: 0 }, { from: 2, to: 3 },
    ],
  },
  /** Four colours, one spare, and most openings lose. */
  {
    kind: 'tube', id: 'tube-41', title: 'No second chances', capacity: 4,
    tubes: [
      ['green', 'red', 'yellow', 'red'],
      ['blue', 'blue', 'yellow', 'green'],
      ['yellow', 'green', 'red', 'green'],
      ['blue', 'blue', 'yellow', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 3, to: 4 }, { from: 0, to: 3 }, { from: 0, to: 4 },
      { from: 1, to: 0 }, { from: 2, to: 0 }, { from: 2, to: 4 }, { from: 2, to: 0 },
      { from: 1, to: 2 }, { from: 3, to: 2 }, { from: 1, to: 3 },
    ],
  },
  /** Four colours, one spare. */
  {
    kind: 'tube', id: 'tube-42', title: 'Plan the empty tube', capacity: 4,
    tubes: [
      ['red', 'blue', 'red', 'green'],
      ['green', 'yellow', 'green', 'blue'],
      ['yellow', 'green', 'yellow', 'red'],
      ['blue', 'blue', 'yellow', 'red'],
      [],
    ],
    solution: [
      { from: 2, to: 4 }, { from: 3, to: 4 }, { from: 2, to: 3 }, { from: 0, to: 2 },
      { from: 0, to: 4 }, { from: 1, to: 0 }, { from: 1, to: 2 }, { from: 3, to: 1 },
      { from: 0, to: 3 }, { from: 0, to: 4 }, { from: 1, to: 0 }, { from: 2, to: 1 },
      { from: 0, to: 2 },
    ],
  },
  /** Taller tubes hold five, with one spare. */
  {
    kind: 'tube', id: 'tube-43', title: 'Five high', capacity: 5,
    tubes: [
      ['green', 'green', 'red', 'green', 'red'],
      ['blue', 'blue', 'red', 'blue', 'green'],
      ['red', 'blue', 'green', 'blue', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 1, to: 0 }, { from: 2, to: 3 }, { from: 1, to: 2 },
      { from: 1, to: 3 }, { from: 2, to: 1 }, { from: 0, to: 2 }, { from: 0, to: 3 },
      { from: 2, to: 0 }, { from: 2, to: 1 }, { from: 2, to: 3 },
    ],
  },
  /** Five colours and a single spare. */
  {
    kind: 'tube', id: 'tube-44', title: 'Orange in the tubes', capacity: 4,
    tubes: [
      ['blue', 'orange', 'red', 'orange'],
      ['red', 'yellow', 'green', 'green'],
      ['green', 'orange', 'yellow', 'yellow'],
      ['yellow', 'red', 'blue', 'green'],
      ['orange', 'blue', 'blue', 'red'],
      [],
    ],
    solution: [
      { from: 1, to: 5 }, { from: 2, to: 1 }, { from: 0, to: 2 }, { from: 3, to: 5 },
      { from: 4, to: 0 }, { from: 3, to: 4 }, { from: 0, to: 3 }, { from: 0, to: 2 },
      { from: 4, to: 0 }, { from: 2, to: 4 }, { from: 2, to: 5 }, { from: 1, to: 2 },
      { from: 3, to: 1 }, { from: 2, to: 3 },
    ],
  },
  /** Five colours, one spare, few safe openings. */
  {
    kind: 'tube', id: 'tube-46', title: 'The last spare', capacity: 4,
    tubes: [
      ['blue', 'orange', 'orange', 'blue'],
      ['red', 'orange', 'green', 'yellow'],
      ['yellow', 'yellow', 'green', 'yellow'],
      ['orange', 'blue', 'green', 'green'],
      ['red', 'blue', 'red', 'red'],
      [],
    ],
    solution: [
      { from: 1, to: 5 }, { from: 2, to: 5 }, { from: 2, to: 1 }, { from: 2, to: 5 },
      { from: 1, to: 2 }, { from: 3, to: 2 }, { from: 0, to: 3 }, { from: 0, to: 1 },
      { from: 3, to: 0 }, { from: 1, to: 3 }, { from: 4, to: 1 }, { from: 4, to: 0 },
      { from: 1, to: 4 },
    ],
  },
  /** Four colours in tubes of six. */
  {
    kind: 'tube', id: 'tube-47', title: 'Tall tubes', capacity: 6,
    tubes: [
      ['yellow', 'blue', 'red', 'red', 'green', 'red'],
      ['green', 'blue', 'yellow', 'yellow', 'yellow', 'green'],
      ['yellow', 'green', 'red', 'yellow', 'red', 'blue'],
      ['blue', 'green', 'blue', 'green', 'blue', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 1, to: 0 }, { from: 3, to: 4 }, { from: 2, to: 3 },
      { from: 2, to: 4 }, { from: 2, to: 1 }, { from: 2, to: 4 }, { from: 0, to: 2 },
      { from: 0, to: 4 }, { from: 3, to: 0 }, { from: 3, to: 2 }, { from: 0, to: 3 },
      { from: 1, to: 0 }, { from: 3, to: 1 }, { from: 3, to: 2 }, { from: 1, to: 3 },
      { from: 2, to: 1 }, { from: 0, to: 2 },
    ],
  },
  /** Three colours, one spare. */
  {
    kind: 'tube', id: 'tube-48', title: 'Short and careful', capacity: 4,
    tubes: [
      ['green', 'red', 'green', 'red'],
      ['blue', 'blue', 'green', 'blue'],
      ['blue', 'green', 'red', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 2, to: 3 }, { from: 0, to: 2 }, { from: 0, to: 3 },
      { from: 2, to: 0 }, { from: 1, to: 2 }, { from: 1, to: 0 }, { from: 1, to: 2 },
    ],
  },
  /** Five colours and a single spare. */
  {
    kind: 'tube', id: 'tube-49', title: 'Five and one', capacity: 4,
    tubes: [
      ['yellow', 'yellow', 'orange', 'blue'],
      ['orange', 'green', 'red', 'green'],
      ['blue', 'orange', 'blue', 'yellow'],
      ['blue', 'green', 'orange', 'red'],
      ['green', 'red', 'yellow', 'red'],
      [],
    ],
    solution: [
      { from: 3, to: 5 }, { from: 4, to: 5 }, { from: 2, to: 4 }, { from: 0, to: 2 },
      { from: 0, to: 3 }, { from: 4, to: 0 }, { from: 4, to: 5 }, { from: 1, to: 4 },
      { from: 1, to: 5 }, { from: 1, to: 4 }, { from: 3, to: 1 }, { from: 3, to: 4 },
      { from: 2, to: 3 }, { from: 2, to: 1 }, { from: 2, to: 3 },
    ],
  },
  /** No empty tube: the spare room is spread over part-full tubes. */
  {
    kind: 'tube', id: 'tube-50', title: 'Room spread thin', capacity: 4,
    tubes: [
      ['blue', 'blue', 'green', 'blue'],
      ['green', 'red', 'green'],
      ['orange', 'red', 'orange'],
      ['red', 'yellow'],
      ['green', 'yellow', 'yellow', 'orange'],
      ['yellow', 'orange', 'blue', 'red'],
    ],
    solution: [
      { from: 4, to: 2 }, { from: 3, to: 4 }, { from: 5, to: 3 }, { from: 0, to: 5 },
      { from: 0, to: 1 }, { from: 5, to: 0 }, { from: 2, to: 5 }, { from: 2, to: 3 },
      { from: 5, to: 2 }, { from: 4, to: 5 }, { from: 1, to: 4 }, { from: 1, to: 3 },
      { from: 1, to: 4 },
    ],
  },
  /** Four tall colours, one spare. */
  {
    kind: 'tube', id: 'tube-51', title: 'Towering', capacity: 6,
    tubes: [
      ['green', 'green', 'blue', 'yellow', 'red', 'blue'],
      ['blue', 'yellow', 'green', 'red', 'blue', 'red'],
      ['yellow', 'yellow', 'blue', 'green', 'red', 'yellow'],
      ['blue', 'red', 'green', 'yellow', 'green', 'red'],
      [],
    ],
    solution: [
      { from: 1, to: 4 }, { from: 0, to: 1 }, { from: 0, to: 4 }, { from: 2, to: 0 },
      { from: 2, to: 4 }, { from: 3, to: 4 }, { from: 2, to: 3 }, { from: 1, to: 2 },
      { from: 1, to: 4 }, { from: 3, to: 1 }, { from: 0, to: 3 }, { from: 0, to: 2 },
      { from: 1, to: 0 }, { from: 3, to: 1 }, { from: 3, to: 0 }, { from: 3, to: 4 },
      { from: 2, to: 3 }, { from: 1, to: 2 }, { from: 1, to: 3 },
    ],
  },
  /** Five colours over six part-full tubes. */
  {
    kind: 'tube', id: 'tube-52', title: 'Half full', capacity: 4,
    tubes: [
      ['red', 'red', 'green'],
      ['yellow', 'green', 'yellow', 'green'],
      ['blue', 'orange', 'blue'],
      ['orange', 'yellow', 'orange'],
      ['orange', 'blue', 'red'],
      ['yellow', 'green', 'blue', 'red'],
    ],
    solution: [
      { from: 1, to: 0 }, { from: 5, to: 4 }, { from: 2, to: 5 }, { from: 2, to: 3 },
      { from: 5, to: 2 }, { from: 0, to: 5 }, { from: 4, to: 0 }, { from: 4, to: 2 },
      { from: 3, to: 4 }, { from: 3, to: 1 }, { from: 3, to: 4 }, { from: 5, to: 3 },
      { from: 1, to: 5 }, { from: 1, to: 3 }, { from: 1, to: 5 },
    ],
  },
  /** Three colours in tall tubes. */
  {
    kind: 'tube', id: 'tube-53', title: 'Six high', capacity: 6,
    tubes: [
      ['green', 'green', 'red', 'green', 'blue', 'red'],
      ['blue', 'blue', 'green', 'blue', 'red', 'red'],
      ['blue', 'red', 'green', 'green', 'blue', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 1, to: 3 }, { from: 0, to: 1 }, { from: 2, to: 3 },
      { from: 2, to: 1 }, { from: 0, to: 2 }, { from: 0, to: 3 }, { from: 2, to: 0 },
      { from: 2, to: 3 }, { from: 1, to: 2 }, { from: 1, to: 0 }, { from: 1, to: 2 },
    ],
  },
  /** Five colours in tubes of five. */
  {
    kind: 'tube', id: 'tube-54', title: 'Five by five', capacity: 5,
    tubes: [
      ['blue', 'orange', 'orange', 'blue', 'yellow'],
      ['yellow', 'blue', 'green', 'red', 'orange'],
      ['yellow', 'red', 'orange', 'blue', 'green'],
      ['green', 'yellow', 'blue', 'green', 'orange'],
      ['red', 'green', 'red', 'yellow', 'red'],
      [],
    ],
    solution: [
      { from: 1, to: 5 }, { from: 3, to: 5 }, { from: 2, to: 3 }, { from: 4, to: 1 },
      { from: 0, to: 4 }, { from: 0, to: 2 }, { from: 0, to: 5 }, { from: 2, to: 0 },
      { from: 2, to: 5 }, { from: 1, to: 2 }, { from: 3, to: 1 }, { from: 3, to: 0 },
      { from: 4, to: 3 }, { from: 4, to: 2 }, { from: 1, to: 4 }, { from: 1, to: 0 },
      { from: 3, to: 1 }, { from: 4, to: 3 }, { from: 2, to: 4 }, { from: 1, to: 2 },
    ],
  },
  /** Five colours in tubes of five. */
  {
    kind: 'tube', id: 'tube-55', title: 'Five tall', capacity: 5,
    tubes: [
      ['orange', 'blue', 'yellow', 'orange', 'green'],
      ['green', 'green', 'orange', 'red', 'red'],
      ['blue', 'red', 'orange', 'yellow', 'red'],
      ['blue', 'orange', 'yellow', 'blue', 'yellow'],
      ['yellow', 'green', 'green', 'blue', 'red'],
      [],
    ],
    solution: [
      { from: 1, to: 5 }, { from: 2, to: 5 }, { from: 3, to: 2 }, { from: 4, to: 5 },
      { from: 4, to: 3 }, { from: 0, to: 4 }, { from: 0, to: 1 }, { from: 2, to: 0 },
      { from: 1, to: 2 }, { from: 4, to: 1 }, { from: 0, to: 4 }, { from: 3, to: 0 },
      { from: 3, to: 4 }, { from: 2, to: 3 }, { from: 2, to: 5 }, { from: 0, to: 2 },
      { from: 3, to: 0 }, { from: 2, to: 3 },
    ],
  },
  /** Four colours, one spare, few moves, many traps. */
  {
    kind: 'tube', id: 'tube-56', title: 'Short and sharp', capacity: 4,
    tubes: [
      ['yellow', 'red', 'green', 'green'],
      ['green', 'red', 'blue', 'yellow'],
      ['red', 'blue', 'yellow', 'blue'],
      ['blue', 'yellow', 'green', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 3, to: 0 }, { from: 3, to: 4 }, { from: 1, to: 3 },
      { from: 2, to: 1 }, { from: 2, to: 3 }, { from: 1, to: 2 }, { from: 0, to: 1 },
      { from: 3, to: 0 }, { from: 2, to: 3 }, { from: 1, to: 2 }, { from: 1, to: 4 },
    ],
  },
  /** The spare room is spread over part-full tubes. */
  {
    kind: 'tube', id: 'tube-57', title: 'Scattered room', capacity: 4,
    tubes: [
      ['red', 'yellow', 'yellow', 'green'],
      ['blue', 'blue', 'yellow', 'green'],
      ['red', 'red', 'green'],
      ['blue', 'blue', 'green'],
      ['yellow', 'red'],
    ],
    solution: [
      { from: 2, to: 3 }, { from: 2, to: 4 }, { from: 0, to: 2 }, { from: 1, to: 2 },
      { from: 1, to: 0 }, { from: 3, to: 2 }, { from: 1, to: 3 }, { from: 0, to: 1 },
      { from: 4, to: 0 }, { from: 1, to: 4 },
    ],
  },
  /** Five colours over six part-full tubes. */
  {
    kind: 'tube', id: 'tube-58', title: 'Half-full rest', capacity: 4,
    tubes: [
      ['orange', 'green', 'red', 'green'],
      ['red', 'yellow'],
      ['blue', 'blue', 'blue', 'green'],
      ['yellow', 'yellow', 'green', 'orange'],
      ['blue', 'orange', 'orange'],
      ['yellow', 'red', 'red'],
    ],
    solution: [
      { from: 3, to: 4 }, { from: 0, to: 3 }, { from: 0, to: 5 }, { from: 3, to: 0 },
      { from: 1, to: 3 }, { from: 5, to: 1 }, { from: 3, to: 5 }, { from: 0, to: 3 },
      { from: 2, to: 3 }, { from: 4, to: 0 }, { from: 2, to: 4 },
    ],
  },
  /** Black and its three dots, with three familiar colours. */
  {
    kind: 'tube', id: 'tube-59', title: 'Black in the tubes', capacity: 4,
    tubes: [
      ['black', 'red', 'black', 'blue'],
      ['blue', 'yellow', 'blue', 'red'],
      ['yellow', 'blue', 'yellow', 'black'],
      ['red', 'red', 'yellow', 'black'],
      [],
    ],
    solution: [
      { from: 2, to: 4 }, { from: 3, to: 4 }, { from: 2, to: 3 }, { from: 0, to: 2 },
      { from: 0, to: 4 }, { from: 1, to: 0 }, { from: 1, to: 2 }, { from: 3, to: 1 },
      { from: 0, to: 3 }, { from: 0, to: 4 }, { from: 1, to: 0 }, { from: 2, to: 1 },
      { from: 0, to: 2 },
    ],
  },
  /** Five colours spread over seven tubes. */
  {
    kind: 'tube', id: 'tube-60', title: 'Seven part-full', capacity: 4,
    tubes: [
      ['green', 'orange', 'yellow'],
      ['red', 'orange', 'yellow', 'orange'],
      ['yellow', 'blue', 'red'],
      ['blue', 'green'],
      ['orange', 'blue'],
      ['green', 'yellow'],
      ['green', 'blue', 'red', 'red'],
    ],
    solution: [
      { from: 0, to: 5 }, { from: 1, to: 0 }, { from: 1, to: 5 }, { from: 0, to: 1 },
      { from: 3, to: 0 }, { from: 4, to: 3 }, { from: 1, to: 4 }, { from: 2, to: 1 },
      { from: 2, to: 3 }, { from: 5, to: 2 }, { from: 0, to: 5 }, { from: 6, to: 1 },
      { from: 6, to: 3 }, { from: 5, to: 6 },
    ],
  },
  /** Four colours in tubes of five. */
  {
    kind: 'tube', id: 'tube-61', title: 'Five-high puzzle', capacity: 5,
    tubes: [
      ['yellow', 'red', 'green', 'green', 'blue'],
      ['yellow', 'green', 'red', 'yellow', 'blue'],
      ['red', 'blue', 'blue', 'green', 'yellow'],
      ['green', 'yellow', 'blue', 'red', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 1, to: 4 }, { from: 2, to: 1 }, { from: 2, to: 0 },
      { from: 2, to: 4 }, { from: 3, to: 2 }, { from: 3, to: 4 }, { from: 1, to: 3 },
      { from: 1, to: 2 }, { from: 0, to: 1 }, { from: 0, to: 2 }, { from: 3, to: 0 },
      { from: 1, to: 3 }, { from: 0, to: 1 },
    ],
  },
  /** Black with three colours, one spare. */
  {
    kind: 'tube', id: 'tube-62', title: 'Black and spare', capacity: 4,
    tubes: [
      ['black', 'yellow', 'yellow', 'yellow'],
      ['yellow', 'blue', 'red', 'black'],
      ['red', 'blue', 'red', 'blue'],
      ['blue', 'red', 'black', 'black'],
      [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 1, to: 0 }, { from: 3, to: 0 }, { from: 1, to: 3 },
      { from: 2, to: 1 }, { from: 2, to: 3 }, { from: 2, to: 1 }, { from: 3, to: 2 },
      { from: 1, to: 3 }, { from: 1, to: 4 },
    ],
  },
  /** Black with three colours, a gentle sort. */
  {
    kind: 'tube', id: 'tube-63', title: 'Black, gently', capacity: 4,
    tubes: [
      ['black', 'blue', 'yellow', 'red'],
      ['yellow', 'red', 'black', 'yellow'],
      ['blue', 'black', 'blue', 'yellow'],
      ['red', 'red', 'blue', 'black'],
      [],
    ],
    solution: [
      { from: 1, to: 4 }, { from: 2, to: 4 }, { from: 3, to: 1 }, { from: 2, to: 3 },
      { from: 1, to: 2 }, { from: 0, to: 1 }, { from: 0, to: 4 }, { from: 3, to: 0 },
      { from: 1, to: 3 }, { from: 1, to: 4 }, { from: 0, to: 1 }, { from: 2, to: 0 },
      { from: 1, to: 2 },
    ],
  },
  /** Five colours, one spare. */
  {
    kind: 'tube', id: 'tube-64', title: 'Five and a spare', capacity: 4,
    tubes: [
      ['red', 'red', 'blue', 'blue'],
      ['green', 'green', 'yellow', 'orange'],
      ['blue', 'red', 'orange', 'yellow'],
      ['yellow', 'green', 'green', 'orange'],
      ['yellow', 'blue', 'orange', 'red'],
      [],
    ],
    solution: [
      { from: 1, to: 5 }, { from: 2, to: 1 }, { from: 2, to: 5 }, { from: 3, to: 5 },
      { from: 4, to: 2 }, { from: 4, to: 5 }, { from: 0, to: 4 }, { from: 2, to: 0 },
      { from: 4, to: 2 }, { from: 1, to: 4 }, { from: 3, to: 1 }, { from: 3, to: 4 },
    ],
  },
  /** Four colours, one spare, most openings lose. */
  {
    kind: 'tube', id: 'tube-65', title: 'One wrong move', capacity: 4,
    tubes: [
      ['yellow', 'blue', 'blue', 'green'],
      ['blue', 'red', 'yellow', 'green'],
      ['green', 'green', 'red', 'blue'],
      ['yellow', 'red', 'yellow', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 1, to: 4 }, { from: 2, to: 0 }, { from: 3, to: 2 },
      { from: 1, to: 3 }, { from: 2, to: 1 }, { from: 2, to: 4 }, { from: 1, to: 2 },
      { from: 0, to: 1 }, { from: 3, to: 0 }, { from: 3, to: 2 }, { from: 0, to: 3 },
    ],
  },
  /** Five colours in tubes of five. */
  {
    kind: 'tube', id: 'tube-66', title: 'Tower of five', capacity: 5,
    tubes: [
      ['blue', 'red', 'blue', 'green', 'orange'],
      ['green', 'green', 'yellow', 'red', 'yellow'],
      ['orange', 'yellow', 'green', 'blue', 'green'],
      ['orange', 'yellow', 'orange', 'yellow', 'red'],
      ['blue', 'blue', 'red', 'orange', 'red'],
      [],
    ],
    solution: [
      { from: 3, to: 5 }, { from: 1, to: 3 }, { from: 1, to: 5 }, { from: 3, to: 1 },
      { from: 0, to: 3 }, { from: 2, to: 0 }, { from: 4, to: 5 }, { from: 4, to: 3 },
      { from: 4, to: 5 }, { from: 2, to: 4 }, { from: 0, to: 2 }, { from: 0, to: 4 },
      { from: 0, to: 5 }, { from: 0, to: 4 }, { from: 1, to: 0 }, { from: 2, to: 1 },
      { from: 2, to: 0 }, { from: 3, to: 2 }, { from: 3, to: 0 }, { from: 2, to: 3 },
    ],
  },
  /** Every colour so far, one spare. */
  {
    kind: 'tube', id: 'tube-67', title: 'Six colours', capacity: 4,
    tubes: [
      ['blue', 'blue', 'black', 'green'],
      ['green', 'yellow', 'yellow', 'orange'],
      ['red', 'black', 'blue', 'green'],
      ['black', 'red', 'black', 'orange'],
      ['green', 'orange', 'orange', 'yellow'],
      ['yellow', 'blue', 'red', 'red'],
      [],
    ],
    solution: [
      { from: 1, to: 6 }, { from: 3, to: 6 }, { from: 4, to: 1 }, { from: 4, to: 6 },
      { from: 0, to: 4 }, { from: 0, to: 3 }, { from: 2, to: 4 }, { from: 2, to: 0 },
      { from: 3, to: 2 }, { from: 5, to: 3 }, { from: 5, to: 0 }, { from: 1, to: 5 },
      { from: 1, to: 4 }, { from: 2, to: 1 }, { from: 3, to: 2 }, { from: 1, to: 3 },
    ],
  },
  /** Four colours, one spare. */
  {
    kind: 'tube', id: 'tube-68', title: 'Breathing space', capacity: 4,
    tubes: [
      ['red', 'yellow', 'yellow', 'yellow'],
      ['yellow', 'green', 'blue', 'red'],
      ['blue', 'green', 'blue', 'green'],
      ['green', 'blue', 'red', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 1, to: 0 }, { from: 3, to: 0 }, { from: 1, to: 3 },
      { from: 2, to: 1 }, { from: 2, to: 3 }, { from: 2, to: 1 }, { from: 3, to: 2 },
      { from: 1, to: 3 }, { from: 1, to: 4 },
    ],
  },
  /** Five colours in tubes of six. */
  {
    kind: 'tube', id: 'tube-69', title: 'Tall and long', capacity: 6,
    tubes: [
      ['red', 'orange', 'yellow', 'orange', 'blue', 'green'],
      ['blue', 'yellow', 'red', 'orange', 'red', 'green'],
      ['yellow', 'red', 'red', 'blue', 'green', 'blue'],
      ['yellow', 'green', 'orange', 'orange', 'yellow', 'blue'],
      ['orange', 'blue', 'yellow', 'green', 'green', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 5 }, { from: 1, to: 5 }, { from: 2, to: 0 }, { from: 2, to: 5 },
      { from: 3, to: 2 }, { from: 4, to: 1 }, { from: 4, to: 5 }, { from: 4, to: 3 },
      { from: 0, to: 4 }, { from: 2, to: 4 }, { from: 1, to: 2 }, { from: 0, to: 1 },
      { from: 3, to: 0 }, { from: 1, to: 3 }, { from: 1, to: 2 }, { from: 0, to: 1 },
      { from: 3, to: 0 }, { from: 3, to: 5 }, { from: 1, to: 3 }, { from: 4, to: 1 },
      { from: 0, to: 4 }, { from: 2, to: 0 }, { from: 2, to: 3 },
    ],
  },
  /** Six colours over eight part-full tubes. */
  {
    kind: 'tube', id: 'tube-70', title: 'Spread across eight', capacity: 4,
    tubes: [
      ['black', 'green'],
      ['black', 'black', 'blue'],
      ['red', 'red', 'orange'],
      ['black', 'orange', 'blue'],
      ['yellow', 'green', 'blue'],
      ['blue', 'orange', 'green', 'yellow'],
      ['yellow', 'orange'],
      ['yellow', 'red', 'green', 'red'],
    ],
    solution: [
      { from: 1, to: 3 }, { from: 2, to: 6 }, { from: 7, to: 2 }, { from: 0, to: 7 },
      { from: 0, to: 1 }, { from: 7, to: 0 }, { from: 7, to: 2 }, { from: 5, to: 7 },
      { from: 5, to: 0 }, { from: 5, to: 6 }, { from: 3, to: 5 }, { from: 4, to: 5 },
      { from: 4, to: 0 }, { from: 4, to: 7 }, { from: 3, to: 4 }, { from: 1, to: 3 },
      { from: 6, to: 4 }, { from: 6, to: 7 },
    ],
  },
  /** No empty tube, little room. */
  {
    kind: 'tube', id: 'tube-71', title: 'Tight spread', capacity: 4,
    tubes: [
      ['yellow', 'blue', 'green'],
      ['red', 'blue', 'red', 'blue'],
      ['green', 'yellow', 'red', 'yellow'],
      ['blue', 'yellow', 'green'],
      ['green', 'red'],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 1, to: 0 }, { from: 1, to: 4 }, { from: 0, to: 1 },
      { from: 2, to: 0 }, { from: 2, to: 4 }, { from: 2, to: 0 }, { from: 3, to: 2 },
      { from: 3, to: 0 }, { from: 1, to: 3 }, { from: 4, to: 1 }, { from: 2, to: 4 },
    ],
  },
  /** Three colours in tubes of six. */
  {
    kind: 'tube', id: 'tube-72', title: 'Three tall', capacity: 6,
    tubes: [
      ['blue', 'green', 'green', 'green', 'blue', 'red'],
      ['green', 'green', 'green', 'red', 'blue', 'blue'],
      ['red', 'blue', 'red', 'red', 'blue', 'red'],
      [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 2, to: 3 }, { from: 2, to: 0 }, { from: 2, to: 3 },
      { from: 0, to: 2 }, { from: 1, to: 2 }, { from: 1, to: 3 }, { from: 0, to: 1 },
      { from: 2, to: 0 }, { from: 2, to: 3 },
    ],
  },
  /** Five colours with black, tubes of five. */
  {
    kind: 'tube', id: 'tube-73', title: 'Black and five high', capacity: 5,
    tubes: [
      ['red', 'orange', 'orange', 'red', 'yellow'],
      ['yellow', 'red', 'green', 'black', 'orange'],
      ['yellow', 'black', 'orange', 'red', 'green'],
      ['green', 'yellow', 'red', 'green', 'orange'],
      ['black', 'green', 'black', 'yellow', 'black'],
      [],
    ],
    solution: [
      { from: 1, to: 5 }, { from: 3, to: 5 }, { from: 2, to: 3 }, { from: 4, to: 1 },
      { from: 0, to: 4 }, { from: 0, to: 2 }, { from: 0, to: 5 }, { from: 2, to: 0 },
      { from: 2, to: 5 }, { from: 1, to: 2 }, { from: 3, to: 1 }, { from: 3, to: 0 },
      { from: 4, to: 3 }, { from: 4, to: 2 }, { from: 1, to: 4 }, { from: 1, to: 0 },
      { from: 3, to: 1 }, { from: 4, to: 3 }, { from: 2, to: 4 }, { from: 1, to: 2 },
    ],
  },
  /** Five colours, one spare. */
  {
    kind: 'tube', id: 'tube-74', title: 'Last of the forty', capacity: 4,
    tubes: [
      ['orange', 'orange', 'red', 'blue'],
      ['green', 'blue', 'orange', 'red'],
      ['blue', 'red', 'yellow', 'yellow'],
      ['orange', 'yellow', 'green', 'green'],
      ['yellow', 'green', 'blue', 'red'],
      [],
    ],
    solution: [
      { from: 1, to: 5 }, { from: 4, to: 5 }, { from: 0, to: 4 }, { from: 0, to: 5 },
      { from: 1, to: 0 }, { from: 4, to: 1 }, { from: 3, to: 4 }, { from: 2, to: 3 },
      { from: 2, to: 5 }, { from: 1, to: 2 }, { from: 4, to: 1 }, { from: 3, to: 4 },
      { from: 0, to: 3 },
    ],
  },
// END first stretch
  /** Rule lesson in the bank only; see docs/levelling.md. */
  {
    kind: 'tube', id: 'tube-200', title: 'The capped spare', capacity: 4,
    containers: [
      { role: 'ordinary', capacity: 4 },
      { role: 'ordinary', capacity: 4 },
      { role: 'ordinary', capacity: 4 },
      { role: 'ordinary', capacity: 4 },
      { role: 'capped', capacity: 4, opensOn: 'red' },
    ],
    tubes: [
      ['blue', 'blue', 'green', 'red'],
      ['red', 'green', 'green', 'green'],
      ['blue', 'blue', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 1, to: 3 }, { from: 0, to: 1 }, { from: 0, to: 3 }, { from: 2, to: 1 },
      { from: 0, to: 2 },
    ],
  },
  /** Rule lesson in the bank only; see docs/levelling.md. */
  {
    kind: 'tube', id: 'tube-201', title: 'One use of the cup', capacity: 4,
    containers: [
      { role: 'ordinary', capacity: 4 },
      { role: 'ordinary', capacity: 4 },
      { role: 'ordinary', capacity: 4 },
      { role: 'ordinary', capacity: 4 },
      { role: 'cup', capacity: 2 },
    ],
    tubes: [
      ['blue', 'blue', 'green', 'red'],
      ['red', 'green', 'green', 'green'],
      ['blue', 'blue', 'red', 'red'],
      [],
      [],
    ],
    solution: [
      { from: 1, to: 3 }, { from: 0, to: 1 }, { from: 0, to: 3 }, { from: 2, to: 1 },
      { from: 0, to: 2 },
    ],
  },
];

import assert from 'node:assert/strict';
import { cloneTubeState, completedTube, moveTubeState, solveTubeSearch, tubeContainer, tubeKey, TubeRules } from '../../../src/puzzles/rules';
import type { TubeDef, TubeState } from '../../../src/puzzles/types';

export type TubeMutation = 'none' | 'local-completion' | 'reusable-cup' | 'cup-unlocks-cap';

/** Ordered-container graph: exploration never uses the production symmetry reduction. */
export function checkTubeVariety(board: TubeDef, mutation: TubeMutation = 'none') {
  const counts = (state: TubeState) => state.tubes.flat().reduce<Record<string, number>>((map, color) => {
    map[color] = (map[color] ?? 0) + 1;
    return map;
  }, {});
  const start = new TubeRules(board).snapshot();
  const conserved = counts(start);
  const raw = (state: TubeState) => JSON.stringify([state.tubes, state.opened, state.spent]);
  const nodes: { state: TubeState; parents: number[] }[] = [{ state: start, parents: [] }];
  const seen = new Map([[raw(start), 0]]);
  let edges = 0, refusals = 0, openings = 0, closings = 0, partialHomes = 0;
  for (let at = 0; at < nodes.length; at++) {
    const state = nodes[at]!.state;
    assert(nodes.length < 20_000, 'Ordered model exhausted its state bound');
    let won = true;
    state.tubes.forEach((tube, i) => {
      const role = tubeContainer(board, i), color = tube[0];
      const expected = role.role !== 'cup' && color !== undefined && tube.length === role.capacity
        && tube.length === conserved[color] && tube.every(c => c === color);
      const locallyFull = role.role !== 'cup' && tube.length === role.capacity && tube.every(c => c === color);
      if (locallyFull && !expected) partialHomes++;
      if (tube.length && !expected) won = false;
      assert.equal(mutation === 'local-completion' ? locallyFull : completedTube(board, state, i), expected,
        'Only a complete colour in its matching-size home is finished');
    });
    const accessible = (i: number) => !state.spent[i] && (tubeContainer(board, i).role !== 'capped' || state.opened[i]);
    const hasMove = state.tubes.some((source, from) => source.length && accessible(from)
      && state.tubes.some((destination, to) => from !== to && accessible(to)
        && destination.length < tubeContainer(board, to).capacity
        && (!destination.length || destination.at(-1) === source.at(-1))));
    assert.equal(state.status, won ? 'won' : hasMove ? 'playing' : 'jammed', 'Status must reflect complete homes or available moves');
    for (let from = 0; from < state.tubes.length; from++) for (let to = 0; to < state.tubes.length; to++) {
      const after = cloneTubeState(state), before = JSON.stringify(after);
      const result = moveTubeState(board, after, from, to);
      if (!result.ok) {
        assert.equal(JSON.stringify(after), before, 'Rejected action changed state');
        refusals++;
        continue;
      }
      edges++;
      const source = state.tubes[from]!, color = source.at(-1)!;
      let run = 0;
      for (let i = source.length - 1; i >= 0 && source[i] === color; i--) run++;
      const expectedCount = Math.min(run, tubeContainer(board, to).capacity - state.tubes[to]!.length);
      assert.equal(result.count, expectedCount, 'Transfer must move the maximum matching run that fits');
      if (mutation === 'reusable-cup' && tubeContainer(board, from).role === 'cup' && !after.tubes[from]!.length) after.spent[from] = false;
      if (mutation === 'cup-unlocks-cap' && tubeContainer(board, to).role === 'cup' && after.tubes[to]!.length === 2) board.tubes.forEach((_, i) => {
        const target = tubeContainer(board, i);
        if (target.role === 'capped' && target.opensOn === color) after.opened[i] = true;
      });
      assert.deepEqual(counts(after), conserved, 'A move lost marbles');
      after.tubes.forEach((tube, i) => {
        assert(tube.length <= tubeContainer(board, i).capacity, 'Capacity exceeded');
        if (state.spent[i]) assert(after.spent[i], 'Spent cup reopened');
        if (state.opened[i]) assert(after.opened[i], 'Open cap closed');
        if (after.spent[i]) assert.equal(tube.length, 0, 'Spent cup holds marbles');
        if (i === from && tubeContainer(board, i).role === 'cup' && state.tubes[i]!.length && !tube.length) {
          assert(after.spent[i], 'Emptying the cup must spend it');
          closings++;
        }
        if (!state.opened[i] && after.opened[i]) {
          const target = tubeContainer(board, i);
          assert(target.role === 'capped' && target.opensOn === color && tubeContainer(board, to).role !== 'cup'
            && after.tubes[to]!.length === conserved[color] && after.tubes[to]!.every(c => c === color),
          'Only a full colour home may open a cap');
          openings++;
        }
      });
      const runtime = new TubeRules(board);
      runtime.restore(state);
      assert(runtime.move(from, to).ok, 'State transition disagrees with gameplay');
      assert.deepEqual(runtime.snapshot(), after, 'Gameplay and search disagree');
      assert(runtime.undo(), 'Accepted move must be undoable');
      assert.deepEqual(runtime.snapshot(), state, 'Undo must restore the complete state');
      const key = raw(after);
      let id = seen.get(key);
      if (id === undefined) {
        id = nodes.length;
        seen.set(key, id);
        nodes.push({ state: after, parents: [] });
      }
      nodes[id]!.parents.push(at);
    }
  }
  const wins = new Set(nodes.flatMap((node, i) => node.state.status === 'won' ? [i] : []));
  const work = [...wins];
  for (const i of work) for (const parent of nodes[i]!.parents) if (!wins.has(parent)) {
    wins.add(parent);
    work.push(parent);
  }
  const classes = new Map<string, boolean>();
  for (let i = 0; i < nodes.length; i++) {
    const state = nodes[i]!.state, key = tubeKey(board, state), winning = wins.has(i);
    if (classes.has(key)) {
      assert.equal(classes.get(key), winning, 'Symmetry key merged winning and losing states');
      continue;
    }
    classes.set(key, winning);
    const solution = solveTubeSearch(board, state);
    assert(solution.exhaustive, 'Current-state search exceeded its default work budget');
    assert.equal(solution.moves !== null, winning, 'Hint search disagrees with ordered graph reachability');
    const replay = cloneTubeState(state);
    for (const move of solution.moves ?? []) assert(moveTubeState(board, replay, move.from, move.to).ok, 'Hint returned an illegal action');
    if (winning) assert.equal(replay.status, 'won', 'Hint continuation did not win');
  }
  assert(wins.has(0), 'Fixture must be solvable');
  assert(nodes.some((_, i) => !wins.has(i)), 'Fixture must include a losing state');
  return { states: nodes.length, canonical: classes.size, edges, refusals, openings, closings, partialHomes };
}

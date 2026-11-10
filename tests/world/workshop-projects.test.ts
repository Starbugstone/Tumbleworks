import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { GameRuntime, GameStatus } from '../../src/engine/contracts';
import type { Replayable, ReplayAction } from '../../src/engine/replay';
import { initPhysics, Machine } from '../../src/machine/machine';
import { LoopMachine } from '../../src/loop/machine';
import { LOOP_VARIETY_BOARDS } from '../../src/loop/variety-boards';
import { TubeRules } from '../../src/puzzles/rules';
import { TUBE_VARIETY_BOARDS } from '../../src/puzzles/variety-boards';
import { setLocale } from '../../src/preferences';
import { FUNNEL_VARIETY_BOARDS } from '../../src/sim/variety-boards';
import { attachProjectGuide } from '../../src/world/workshop-guides';
import { canEnterProject, earnedProjects, projectState, WORKSHOP_PROJECTS, workshopProject } from '../../src/world/workshop-projects';
import { worldProgress, type WorldLevel } from '../../src/world/progression';
import { VARIETY_FAST_WITNESSES } from '../variety-witnesses';

const levels: readonly WorldLevel[] = Array.from({ length: 60 }, (_, round) => [
  { id: `crate-${round * 7 + 4}`, kind: 'conveyor' },
  { id: `lorry-${round * 11 + 9}`, kind: 'loop' },
  { id: `tube-${round * 3 + 1}`, kind: 'tube' },
]).flat();
const builtStops = (stops: readonly number[]): Set<string> => new Set(stops.flatMap(stop => levels.slice(stop * 3, stop * 3 + 3).map(level => level.id)));

afterEach(() => setLocale('en'));

describe('optional village projects', () => {
  it('has seven stable rewards across all six villages without becoming campaign stops', () => {
    expect(WORKSHOP_PROJECTS.map(project => [project.id, project.chapter, project.stops, project.reward])).toEqual([
      ['board-210', 0, 2, 'gantry'], ['board-212', 0, 7, 'bells'],
      ['loop-210', 1, 3, 'waterwheel'], ['tube-210', 2, 4, 'cistern'],
      ['board-211', 3, 3, 'gate'], ['loop-211', 4, 5, 'windmill'], ['tube-211', 5, 6, 'terrace'],
    ]);
    expect(new Set(WORKSHOP_PROJECTS.map(project => project.id)).size).toBe(7);
    expect(new Set(WORKSHOP_PROJECTS.map(project => project.chapter)).size).toBe(6);
    expect(workshopProject('board-210')).toBe(WORKSHOP_PROJECTS[0]);
    expect(workshopProject('unknown')).toBeUndefined();
    expect(canEnterProject('unknown', worldProgress(levels, new Set()), new Set(['unknown']))).toBe(false);
    const titles = WORKSHOP_PROJECTS.map(project => project.rewardTitle);
    setLocale('fr');
    expect(WORKSHOP_PROJECTS.every((project, index) => project.rewardTitle !== titles[index] && project.title === project.rewardTitle)).toBe(true);
  });

  it.each(WORKSHOP_PROJECTS)('$id opens exactly at its local built-stop threshold', project => {
    const first = project.chapter * 10;
    for (const count of [project.stops - 1, project.stops, project.stops + 1]) {
      const completed = builtStops(Array.from({ length: count }, (_, local) => first + local));
      const state = projectState(project, worldProgress(levels, completed), completed);
      expect(state).toMatchObject({ status: count < project.stops ? 'locked' : 'available', built: count, required: project.stops });
      expect(canEnterProject(project.id, worldProgress(levels, completed), completed)).toBe(count >= project.stops);
      expect(earnedProjects(completed)).toEqual([]);
    }
  });

  it('counts whole stops locally, including out-of-order saves, while partial stops count zero', () => {
    const project = workshopProject('loop-210')!;
    const completed = builtStops([0, 1, 3, 10, 13]);
    completed.add(levels[15 * 3]!.id);
    completed.add(levels[15 * 3 + 1]!.id);
    expect(projectState(project, worldProgress(levels, completed), completed)).toMatchObject({ status: 'locked', built: 2 });
    completed.add(levels[15 * 3 + 2]!.id);
    const progress = worldProgress(levels, completed);
    expect(progress.frontier).toBe(2);
    expect(projectState(project, progress, completed)).toMatchObject({ status: 'available', built: 3 });
  });

  it('also requires the village to be available, even if a supplied projection has enough built stops', () => {
    const project = workshopProject('loop-210')!;
    const completed = builtStops([10, 11, 12]);
    const progress = worldProgress(levels, completed);
    const unavailable = { ...progress, chapters: progress.chapters.map(chapter => chapter.index === 1 ? { ...chapter, available: false } : chapter) };
    expect(projectState(project, unavailable, completed)).toMatchObject({ status: 'locked', built: 3 });
    expect(canEnterProject(project.id, unavailable, completed)).toBe(false);
  });

  it('never counts retired, unknown or Workshop completions as main construction', () => {
    const completed = new Set(['tray-1', 'connected-1', 'unknown', ...WORKSHOP_PROJECTS.map(project => project.id)]);
    const progress = worldProgress(levels, completed);
    expect(progress.stops.every(stop => stop.status !== 'built')).toBe(true);
    expect(progress.frontier).toBe(0);
    expect(projectState(workshopProject('board-210')!, progress, new Set())).toMatchObject({ status: 'locked', built: 0 });
  });

  it('grandfathers old project completion for replay and rewards independently of every gate', () => {
    const progress = worldProgress(levels, new Set());
    for (const project of WORKSHOP_PROJECTS) {
      const completed = new Set(['unknown', project.id]);
      expect(projectState(project, progress, completed)).toMatchObject({ status: 'completed', built: 0 });
      expect(canEnterProject(project.id, progress, completed)).toBe(true);
      expect(earnedProjects(completed)).toEqual([project]);
    }
    expect(earnedProjects(new Set(['unknown', 'tray-1']))).toEqual([]);
  });

  it('gives one local stop count in both languages and handles the French singular', () => {
    const completed = builtStops([5]);
    const project = workshopProject('board-210')!;
    const progress = worldProgress(levels, completed);
    expect(projectState(project, progress, completed).label).toBe('Locked · Little Harbour: 1 of 2 stops built');
    setLocale('fr');
    expect(projectState(project, progress, completed).label).toBe('Verrouillé · Le petit port : 1 étape construite sur 2');
  });
});

function runtimeFor(game: Replayable, status: () => GameStatus = () => 'playing'): GameRuntime & { selected: number | null } {
  return {
    game, selected: null, get status() { return status(); }, busy: false, canUndo: false,
    counter: { label: '', value: '' }, preview: [], previewLabel: '', jamReason: '',
    activate: () => [], pick: () => null, hint: () => [], undo: () => false,
    step: () => [], render: () => {}, resize: () => {}, targets: () => ({}),
    inspect() { return { selected: this.selected }; }, dispose: () => {},
  };
}

describe('project guides follow accepted actions', () => {
  beforeAll(initPhysics);

  it.each(FUNNEL_VARIETY_BOARDS)('$id targets the real crate or column from the retained physical witness', board => {
    const machine = new Machine(board);
    try {
      const runtime = runtimeFor(machine, () => machine.rules.status);
      const attached = attachProjectGuide(runtime, board.id, 'This project explains its new rule.');
      expect(attached).toBe(runtime);
      expect(runtime.guideId).toBe(`project-${board.id}`);
      const prefix = VARIETY_FAST_WITNESSES[board.id]!.taps.slice(0, 2);
      for (const [tick, action] of prefix) {
        expect(runtime.guide?.()).toMatchObject({ target: `supply${action}` });
        expect(machine.rules.actions()).toContain(action);
        const before = runtime.guide?.();
        expect(machine.tap(999).ok).toBe(false);
        expect(runtime.guide?.()).toEqual(before);
        while (machine.steps < tick) machine.step();
        expect(machine.tap(action).ok).toBe(true);
      }
      expect(runtime.guide?.().done).toBe(true);
      expect(runtime.status).toBe('playing');
    } finally { machine.world.free(); }
  });

  it.each(LOOP_VARIETY_BOARDS)('$id follows its two actual lane pours while refused taps do not advance it', board => {
    const machine = new LoopMachine(board);
    const runtime = attachProjectGuide(runtimeFor(machine, () => machine.rules.status), board.id, 'The truck rule.');
    for (const [tick, action] of VARIETY_FAST_WITNESSES[board.id]!.taps.slice(0, 2)) {
      expect(runtime.guide?.().target).toBe(`lane${action}`);
      const before = runtime.guide?.();
      expect(machine.tap(999).ok).toBe(false);
      expect(runtime.guide?.()).toEqual(before);
      while (machine.steps < tick) machine.step();
      expect(machine.tap(action).ok).toBe(true);
    }
    expect(runtime.guide?.().done).toBe(true);
    expect(runtime.status).toBe('playing');
  });

  it.each(TUBE_VARIETY_BOARDS)('$id alternates source and destination without advancing on selection, invalid move or cancelled drag', board => {
    const rules = new TubeRules(board);
    const runtime = attachProjectGuide(runtimeFor(rules, () => rules.status), board.id, 'The cup or taller-home rule.');
    for (const move of board.solution.slice(0, 2)) {
      runtime.selected = null;
      expect(runtime.guide?.()).toMatchObject({ target: `tube${move.from}` });
      const before = runtime.guide?.();
      expect(rules.move(move.from, move.from).ok).toBe(false);
      expect(runtime.guide?.()).toEqual(before);
      runtime.selected = move.from;
      expect(runtime.guide?.()).toMatchObject({ target: `tube${move.to}` });
      expect(rules.actions).toHaveLength(board.solution.indexOf(move));
      runtime.selected = null;
      expect(runtime.guide?.()).toEqual(before);
      expect(rules.move(move.from, move.to).ok).toBe(true);
    }
    expect(runtime.guide?.().done).toBe(true);
    expect(runtime.status).toBe('playing');
  });

  it('clears an unrelated tube selection before pointing to the authored source', () => {
    const board = TUBE_VARIETY_BOARDS[0]!;
    const runtime = attachProjectGuide(runtimeFor(new TubeRules(board)), board.id, 'Spend the cup carefully.');
    runtime.selected = 2;
    expect(runtime.guide?.()).toMatchObject({ target: 'tube2' });
    runtime.selected = null;
    expect(runtime.guide?.()).toMatchObject({ target: `tube${board.solution[0]!.from}` });
  });

  it('ends gracefully on accepted deviation and can start again on a fresh runtime', () => {
    const board = TUBE_VARIETY_BOARDS[0]!;
    const rules = new TubeRules(board);
    const runtime = attachProjectGuide(runtimeFor(rules), board.id, 'Spend the cup carefully.');
    expect(rules.move(2, 3).ok).toBe(true);
    expect(runtime.guide?.().done).toBe(true);
    const restarted = attachProjectGuide(runtimeFor(new TubeRules(board)), board.id, 'Spend the cup carefully.');
    expect(restarted.guide?.()).toMatchObject({ target: `tube${board.solution[0]!.from}` });
  });

  it('rewinds the active guide when the first accepted move is undone', () => {
    const board = TUBE_VARIETY_BOARDS[0]!;
    const rules = new TubeRules(board);
    const runtime = attachProjectGuide(runtimeFor(rules), board.id, 'Spend the cup carefully.');
    const first = board.solution[0]!;
    const opening = runtime.guide?.();
    expect(rules.move(first.from, first.to).ok).toBe(true);
    expect(runtime.guide?.()).toMatchObject({ target: `tube${board.solution[1]!.from}` });
    expect(rules.undo()).toBe(true);
    expect(runtime.guide?.()).toEqual(opening);
    expect(rules.actions.map(action => action.type)).toEqual(['move', 'undo']);
  });

  it('shadows prototype guide properties without changing methods or attaching to unknown IDs', () => {
    const actions: ReplayAction[] = [];
    const game: Replayable = { actions, steps: 0, step: () => {}, perform: () => false, fingerprint: () => '' };
    const runtime = runtimeFor(game);
    const originalActivate = runtime.activate;
    Object.setPrototypeOf(runtime, { get guideId() { return 'old-guide'; }, guide: () => ({ text: 'old' }) });
    attachProjectGuide(runtime, 'board-210', () => 'Rule explanation.');
    expect(runtime.guideId).toBe('project-board-210');
    expect(Object.hasOwn(runtime, 'guideId')).toBe(true);
    expect(Object.hasOwn(runtime, 'guide')).toBe(true);
    expect(runtime.activate).toBe(originalActivate);
    expect(runtime.guide?.().text).toContain('Rule explanation.');
    const campaign = runtimeFor(game);
    expect(attachProjectGuide(campaign, 'board-1', 'Campaign instructions.')).toBe(campaign);
    expect(campaign.guideId).toBeUndefined();
    expect(campaign.guide).toBeUndefined();
    expect(attachProjectGuide(campaign, 'toString', 'Unknown instructions.')).toBe(campaign);
    expect(campaign.guideId).toBeUndefined();
  });
});

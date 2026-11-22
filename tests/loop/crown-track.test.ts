import { describe, expect, it } from 'vitest';
import { PLAY_ORDER } from '../../src/campaign';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { bays, CrownTrack, DECK_TOP, LOOP, MARBLE_RADIUS, RIDE_Y, TRUCK, trackFor } from '../../src/loop/layout';
import { LoopMachine, type UnitPose } from '../../src/loop/machine';
import { LOOP_WITNESSES } from '../witnesses';

const SHAPES = ['delta', 'kidney'] as const;
const REACH = LOOP.channelHalf + LOOP.wallThickness;
const cases = SHAPES.flatMap((shape) => [1, 2, 3, 4, 5, 6].map((lanes) => ({ shape, lanes })));
const crown = (shape: 'delta' | 'kidney', lanes: number): CrownTrack => trackFor(lanes, shape) as CrownTrack;
const sampled = (track: CrownTrack, count = 1440) => Array.from({ length: count }, (_, i) => ({ d: i / count * track.length, ...track.point(i / count * track.length) }));
describe('the flat belts above the lorry row', () => {
  it.each(cases)('$shape, $lanes lanes: one common row opens on a straight that travels in lane order', ({ shape, lanes }) => {
    const track = crown(shape, lanes);
    const mouths = bays(lanes).map((bay) => track.nearest(bay.x, track.mouthLine));
    expect(mouths.map((mouth) => mouth.distance)).toEqual(mouths.map((mouth) => mouth.distance).sort((a, b) => a - b));
    for (const [lane, mouth] of mouths.entries()) {
      // The belt is straight, level with the row and heading for the next lane across the whole stream of a pour.
      for (const along of [-0.5, 0, 0.5]) {
        const point = track.point(mouth.distance + along);
        expect(point).toMatchObject({ y: 0, z: track.mouthLine, tx: 1, tz: 0 });
        expect(point.x).toBeCloseTo(bays(lanes)[lane]!.x + along, 9);
      }
    }
  });

  it.each(cases)('$shape, $lanes lanes: the belt stays behind the parked lorries and never meets itself', ({ shape, lanes }) => {
    const track = crown(shape, lanes);
    const points = sampled(track);
    // Every lorry's bed starts a mouth gap in front of the straight; nothing of the belt or its rim reaches that far.
    for (const point of points) expect(point.z).toBeLessThanOrEqual(track.mouthLine);
    expect(track.mouthLine + REACH).toBeLessThan(track.mouthLine + TRUCK.mouthGap);
    // A flat belt cannot cross: two stretches that are not neighbours keep an island between their channels at least
    // as thick as the two walls they would otherwise each need.
    let clearance = Infinity;
    for (const a of points) for (const b of points) {
      const apart = Math.min(Math.abs(a.d - b.d), track.length - Math.abs(a.d - b.d));
      if (apart > Math.PI * track.corner + 0.6) clearance = Math.min(clearance, Math.hypot(a.x - b.x, a.z - b.z));
    }
    expect(clearance).toBeGreaterThan(2 * REACH);
  });

  it.each(cases)('$shape, $lanes lanes: every bend keeps the fillet radius, with room for a real inner wall', ({ shape, lanes }) => {
    const track = crown(shape, lanes);
    expect(track.corner).toBeGreaterThan(REACH);
    let left = 0, right = 0;
    for (let d = 0; d < track.length; d += 0.01) {
      const a = track.point(d), b = track.point(d + 0.01);
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(0.01, 6);
      const turn = a.tx * b.tz - a.tz * b.tx;
      expect(Math.abs(turn)).toBeLessThanOrEqual(0.01 / track.corner + 1e-9);
      if (turn > 1e-6) left += 1; else if (turn < -1e-6) right += 1;
    }
    // Only the kidney bends both ways: its waist turns against the rest of the circuit.
    expect(left > 0 && right > 0).toBe(shape === 'kidney');
  });

  it('draws a skew triangle and an uneven kidney with a waist', () => {
    const delta = crown('delta', 3), kidney = crown('kidney', 3);
    const apex = sampled(delta).reduce((far, point) => point.z < far.z ? point : far);
    const half = (delta.bounds.maxX - delta.bounds.minX) / 2;
    expect(Math.abs(apex.x) / half).toBeGreaterThan(0.2);
    expect(Math.abs(apex.x) / half).toBeLessThan(0.3);
    // Depth of the kidney's far run, read across the toy: a low lobe, a waist, then a tall lobe.
    const depthAt = (x: number): number => kidney.mouthLine - kidney.farZ(x);
    const profile = Array.from({ length: 41 }, (_, i) => depthAt(-2 + i * 0.1));
    const waist = Math.min(...profile), at = profile.indexOf(waist);
    const low = Math.max(...profile.slice(0, at)), tall = Math.max(...profile.slice(at));
    expect(low - waist).toBeGreaterThan(0.45);
    expect(tall - low).toBeGreaterThan(0.8);
    // The waist still leaves an island wall between the far run and the mouth straight.
    expect(waist).toBeGreaterThan(2 * REACH);
  });

  // A three-lane and a four-lane board, each played to a win on both belts, so every lane sends lorries away.
  it.each(SHAPES.flatMap((shape) => ['loop-107', 'loop-111'].map((id) => ({ shape, id }))))(
    '$shape, $id: finished lorries leave straight back along their own lanes to the far rim', { timeout: 120_000 }, ({ shape, id }) => {
      const machine = new LoopMachine({ ...LOOP_BOARDS.find((board) => board.id === id)!, trackShape: shape });
      const track = machine.track as CrownTrack;
      const taps = [...LOOP_WITNESSES[id]!].map((letter) => letter.charCodeAt(0) - 65);
      const last = new Map<string, { lane: number; z: number; scale: number }>();
      for (let tick = 0, next = 0; tick < 60 * 200 && (machine.rules.status === 'playing' || machine.transferring); tick++) {
        machine.step();
        const tap = taps[next];
        if (tap !== undefined && machine.rules.pending === 0 && !machine.rules.canDrain() && tick % 10 === 0 && machine.tap(tap).ok) next += 1;
        for (const truck of machine.readTrucks().filter((candidate) => candidate.departing)) {
          const key = `${truck.lane}:${truck.index}`, before = last.get(key);
          expect(truck.x).toBe(machine.bays[truck.lane]!.x);
          if (before) expect(truck.z).toBeLessThanOrEqual(before.z);
          // While it is still over the belt at any size worth seeing, it has lifted clear of every wall.
          if (truck.z < track.mouthLine + REACH && truck.scale > 0.05) expect(truck.y).toBeGreaterThan(DECK_TOP + 1);
          last.set(key, truck);
        }
      }
      expect(machine.rules.status).toBe('won');
      // The lorries that finish the level stay in their bays for the celebration; every other lane has sent one away.
      expect(new Set([...last.values()].map((truck) => truck.lane)).size).toBeGreaterThanOrEqual(machine.laneCount - 1);
      for (const truck of last.values()) {
        // It has shrunk to nothing at the outer face of the last belt wall on its lane, not somewhere beyond the toy.
        const far = track.farZ(machine.bays[truck.lane]!.x);
        expect(truck.scale).toBeLessThan(0.02);
        expect(truck.z).toBeCloseTo(far - REACH, 1);
        expect(far).toBeLessThan(track.mouthLine - 2 * LOOP.channelHalf);
      }
    });

  const campaign = PLAY_ORDER.loop.map((id) => LOOP_BOARDS.find((board) => board.id === id)!).filter((board) => board.trackShape === 'delta' || board.trackShape === 'kidney');

  it('gives both islands a delta and a kidney, and keeps their drawn rows as close as the rest of the campaign', () => {
    for (const first of [60, 70]) {
      const island = PLAY_ORDER.loop.slice(first, first + 10).map((id) => LOOP_BOARDS.find((board) => board.id === id)!.trackShape);
      expect(island).toEqual(expect.arrayContaining(['delta', 'kidney']));
    }
    for (const board of campaign) {
      const machine = new LoopMachine(board);
      // Two rows or more per unit, about a marble apart: one sparse row made a nearly full belt look half empty.
      expect(machine.rowsPerUnit, board.id).toBeGreaterThanOrEqual(2);
      expect(machine.unitSpacing / machine.rowsPerUnit, board.id).toBeGreaterThanOrEqual(0.3);
      expect(machine.unitSpacing / machine.rowsPerUnit, board.id).toBeLessThanOrEqual(0.46);
    }
  });

  it.each(campaign)('$id: marbles meet the lanes in order and ride between the walls the scene draws from the same track', { timeout: 120_000 }, (board) => {
    const machine = new LoopMachine(board);
    const track = machine.track as CrownTrack;
    const mouths = machine.bays.map((bay) => track.nearest(bay.x, track.mouthLine).distance);
    expect(mouths).toEqual([...mouths].sort((a, b) => a - b));
    expect(new Set(machine.bays.map((_, lane) => machine.mouthZ(lane)))).toEqual(new Set([track.mouthLine + TRUCK.mouthGap]));
    const taps = [...LOOP_WITNESSES[board.id]!].map((letter) => letter.charCodeAt(0) - 65);
    const poses: UnitPose[] = Array.from({ length: machine.marblesPerUnit }, () => ({ x: 0, y: 0, z: 0, roll: 0, visible: false, flight: 0 }));
    let riding = 0;
    for (let tick = 0, next = 0; tick < 60 * 200 && (machine.rules.status === 'playing' || machine.transferring); tick++) {
      machine.step();
      const tap = taps[next];
      if (tap !== undefined && machine.rules.pending === 0 && !machine.rules.canDrain() && tick % 10 === 0 && machine.tap(tap).ok) next += 1;
      if (tick % 7) continue;
      for (const marble of machine.rules.state.marbles) {
        if (marble.status !== 'on-loop') continue;
        machine.readUnit(marble.id, poses);
        for (const pose of poses) {
          // A marble that is on the belt, not hopping on or being thrown off, sits on the floor inside both walls.
          if (!pose.visible || pose.flight > 0 || Math.abs(pose.y - RIDE_Y) > 1e-9) continue;
          expect(Math.abs(track.nearest(pose.x, pose.z).lateral)).toBeLessThan(LOOP.channelHalf - MARBLE_RADIUS);
          riding += 1;
        }
      }
    }
    expect(machine.rules.status).toBe('won');
    expect(riding).toBeGreaterThan(500);
  });
});

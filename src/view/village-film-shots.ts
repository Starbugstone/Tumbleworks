import type { VillageMotionTimeline } from '../world/village-motion';
import type { VillageCameraShot } from '../world/village-plan';

export type VillageCameraTimeline = Pick<VillageMotionTimeline,
  'duration' | 'authoredPlan' | 'plan' | 'contacts' | 'boundaries' | 'transfers'>;

const REST_ELEVATION = 50 * Math.PI / 180;

/** Compositions stay authored; their boundaries follow the compiled physical clock. */
export function villageFilmShots(timeline: VillageCameraTimeline): readonly VillageCameraShot[] {
  const { duration, authoredPlan, boundaries, contacts, transfers } = timeline;
  if (!Number.isFinite(duration) || duration < 2) throw new Error('Village fixed shots require at least two physical seconds');
  const authored = authoredPlan.camera;
  if (authored.length < 1 || authored.length > 7) throw new Error('Village needs one to seven fixed shots');
  const first = authored[0]!, last = authored[authored.length - 1]!;
  if (first.yaw !== 0 || last.yaw !== 0 || first.elevation !== REST_ELEVATION || last.elevation !== REST_ELEVATION
    || first.radius < 66 || last.radius !== first.radius || first.target.some((value, index) => value !== last.target[index])) {
    throw new Error('Village camera needs identical authored rest shots at yaw 0, elevation 50 and radius at least 66');
  }
  let authoredEnd = 0;
  for (const shot of authored) {
    if (shot.start !== authoredEnd || shot.end - shot.start < 2
      || ![shot.start, shot.end, ...shot.target, shot.radius, shot.yaw, shot.elevation].every(Number.isFinite)
      || shot.radius <= 0 || Math.abs(shot.yaw) > 20 * Math.PI / 180
      || shot.elevation < 32 * Math.PI / 180 || shot.elevation > REST_ELEVATION) throw new Error('Invalid authored village camera shot');
    authoredEnd = shot.end;
  }
  let previousAuthoredEnd = 0, previousEnd = 0;
  for (const boundary of boundaries) {
    if (![boundary.authoredStart, boundary.authoredEnd, boundary.start, boundary.end].every(Number.isFinite)
      || boundary.authoredStart < previousAuthoredEnd || boundary.authoredEnd < boundary.authoredStart
      || boundary.start < previousEnd || boundary.end < boundary.start || boundary.end > duration
      || boundary.authoredEnd > authoredEnd) throw new Error('Invalid compiled village time boundary');
    previousAuthoredEnd = boundary.authoredEnd; previousEnd = boundary.end;
  }
  if (!boundaries.length) throw new Error('Village camera requires compiled time boundaries');
  for (const transfer of transfers) if (![transfer.start, transfer.end].every(Number.isFinite)
    || transfer.start < 0 || transfer.end < transfer.start || transfer.end > duration) throw new Error('Invalid village transfer interval');
  for (const contact of contacts) if (!Number.isFinite(contact.contact) || contact.contact < 0 || contact.contact > duration) {
    throw new Error('Invalid village camera contact');
  }

  const interpolate = (time: number, a: number, b: number, start: number, end: number): number =>
    b === a ? end : start + (end - start) * (time - a) / (b - a);
  const physicalTime = (time: number): number => {
    let authoredStart = 0, start = 0;
    for (const boundary of boundaries) {
      if (time < boundary.authoredStart) return interpolate(time, authoredStart, boundary.authoredStart, start, boundary.start);
      if (time <= boundary.authoredEnd) return interpolate(time, boundary.authoredStart, boundary.authoredEnd, boundary.start, boundary.end);
      authoredStart = boundary.authoredEnd; start = boundary.end;
    }
    return interpolate(time, authoredStart, authoredEnd, start, duration);
  };
  const protectedCut = (time: number): boolean =>
    transfers.some(transfer => time >= transfer.start && time <= transfer.end)
    || contacts.some(contact => time > contact.contact - 0.3 && time <= contact.contact);

  const groups = [{ start: 0, shot: first }];
  for (const shot of authored.slice(1)) {
    const start = physicalTime(shot.start);
    // Removing a cut merges compositions without changing any physical sample time.
    if (start - groups[groups.length - 1]!.start < 2 || duration - start < 2 || protectedCut(start)) continue;
    groups.push({ start, shot });
  }
  return groups.map((group, index) => ({
    ...(index === 0 || index === groups.length - 1 ? first : group.shot),
    start: group.start, end: groups[index + 1]?.start ?? duration,
  }));
}

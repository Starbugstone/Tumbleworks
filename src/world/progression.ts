export const LEVELS_PER_STOP = 3;
export const STOPS_PER_CHAPTER = 10;

export interface WorldLevel { readonly id: string; readonly kind: string }
export interface WorldStop {
  readonly index: number;
  readonly chapter: number;
  readonly local: number;
  readonly levels: readonly WorldLevel[];
  readonly firstLevel: number;
  readonly completed: number;
  readonly status: 'built' | 'available' | 'locked';
}
export interface WorldChapter {
  readonly index: number;
  readonly key: string;
  readonly stops: readonly WorldStop[];
  readonly complete: boolean;
  readonly available: boolean;
}
export interface WorldProgress {
  readonly stops: readonly WorldStop[];
  readonly chapters: readonly WorldChapter[];
  readonly frontier: number;
}

/** Only campaign IDs enter this projection. Workshop wins and retired saves cannot unlock a stop. */
export function worldProgress(levels: readonly WorldLevel[], completed: ReadonlySet<string>): WorldProgress {
  if (levels.length % LEVELS_PER_STOP !== 0) throw new Error('The valley needs complete rounds of three games');
  const ids = new Set<string>();
  for (const level of levels) {
    if (ids.has(level.id)) throw new Error(`Duplicate world level: ${level.id}`);
    ids.add(level.id);
  }
  const roundLevels = Array.from({ length: levels.length / LEVELS_PER_STOP }, (_, index) => levels.slice(index * LEVELS_PER_STOP, (index + 1) * LEVELS_PER_STOP));
  for (const round of roundLevels) if (round.map(level => level.kind).join(',') !== 'conveyor,loop,tube') throw new Error('A construction stop needs Funnel Sort, Loop Sort and Tube Sort, in order');
  const counts = roundLevels.map(round => round.filter(level => completed.has(level.id)).length);
  const missing = counts.findIndex(count => count < LEVELS_PER_STOP);
  const frontier = missing < 0 ? roundLevels.length : missing;
  const stops: WorldStop[] = roundLevels.map((round, index) => ({
    index, chapter: Math.floor(index / STOPS_PER_CHAPTER), local: index % STOPS_PER_CHAPTER,
    levels: round, firstLevel: index * LEVELS_PER_STOP, completed: counts[index]!,
    status: counts[index] === LEVELS_PER_STOP ? 'built' : index === frontier || counts[index]! > 0 ? 'available' : 'locked',
  }));
  const chapters: WorldChapter[] = Array.from({ length: Math.ceil(stops.length / STOPS_PER_CHAPTER) }, (_, index) => {
    const group = stops.slice(index * STOPS_PER_CHAPTER, (index + 1) * STOPS_PER_CHAPTER);
    return {
      index, key: `valley:${group[0]!.levels[0]!.id}:${group.at(-1)!.levels.at(-1)!.id}`,
      stops: group, complete: group.every(stop => stop.status === 'built'), available: group.some(stop => stop.status !== 'locked'),
    };
  });
  return { stops, chapters, frontier };
}

export function enterStop(stop: WorldStop, completed: ReadonlySet<string>): { index: number; replay: boolean } | null {
  if (stop.status === 'locked') return null;
  const missing = stop.levels.findIndex(level => !completed.has(level.id));
  return { index: stop.firstLevel + Math.max(0, missing), replay: missing < 0 };
}

/** A won level can continue inside its accepted stop, but crossing the boundary always needs a map tap. */
export function nextInStop(stop: WorldStop, current: number, completed: ReadonlySet<string>, replay: boolean): number | null {
  if (current < stop.firstLevel || current >= stop.firstLevel + stop.levels.length) throw new Error('Level belongs to another construction stop');
  if (replay) return current + 1 < stop.firstLevel + stop.levels.length ? current + 1 : null;
  const missing = stop.levels.findIndex(level => !completed.has(level.id));
  return missing < 0 ? null : stop.firstLevel + missing;
}

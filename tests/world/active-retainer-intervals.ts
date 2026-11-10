export interface ForeignObservation {
  readonly time: number;
  readonly names: readonly string[];
}
export interface ActualBoundary {
  readonly time: number;
  readonly label: string;
}
export interface EdgeBracket {
  /** The first/last foreign instant is somewhere in this closed time bracket. */
  readonly earliest: number;
  readonly latest: number;
  readonly earliestForeign: boolean;
  readonly latestForeign: boolean;
  readonly kind: 'sample-transition' | 'film-start' | 'film-end';
  readonly boundary?: ActualBoundary;
}
export interface ForeignIntervalBounds {
  readonly ray: number;
  readonly first: EdgeBracket;
  readonly last: EdgeBracket;
  readonly lowerDuration: number;
  readonly upperDuration: number;
  readonly verdict: 'within-limit' | 'exceeds-limit' | 'unproven';
  readonly names: readonly string[];
  readonly interiorSamples: number;
  readonly maximumInteriorStep: number;
}
export interface IntervalRefinement {
  readonly ray: number;
  readonly coarse: readonly ForeignObservation[];
  readonly filmStart: number;
  readonly filmEnd: number;
  readonly boundaries: readonly ActualBoundary[];
  /** Must seek the actual scene and classify the UNION of every foreign mesh. */
  readonly observe: (time: number, ray: number) => ForeignObservation;
}
export interface IntervalRefinementResult {
  readonly ray: number;
  readonly intervals: readonly ForeignIntervalBounds[];
  readonly samples: readonly ForeignObservation[];
  readonly hz: 240;
  readonly edgeResolution: .001;
  readonly limit: .25;
  readonly scope: string;
}

const HZ = 240 as const;
const EDGE_RESOLUTION = .001 as const;
const LIMIT = .25 as const;
const foreign = (sample: ForeignObservation) => sample.names.length !== 0;

export function intervalVerdict(lower: number, upper: number): ForeignIntervalBounds['verdict'] {
  if (![lower, upper].every(Number.isFinite) || lower < 0 || upper < lower) throw new Error('Invalid interval bounds');
  return upper <= LIMIT ? 'within-limit' : lower > LIMIT ? 'exceeds-limit' : 'unproven';
}

/** G-B refines each existing coarse UNION interval, never per mesh identity.
 * Both edge brackets come from actual clear/foreign observations, not a fixed
 * extra first bin. Exact phase boundaries participate as ordinary real seeks.
 * This is a finite 240Hz observation audit, not a continuous-time visibility proof.
 */
export function refineForeignIntervals(input: IntervalRefinement): IntervalRefinementResult {
  const { ray, coarse, filmStart, filmEnd, boundaries, observe } = input;
  if (!Number.isInteger(ray) || ray < -1 || ray > 15 || !Number.isFinite(filmStart) || !Number.isFinite(filmEnd) || filmEnd <= filmStart ||
      coarse.length < 2 || coarse[0]!.time !== filmStart || coarse.at(-1)!.time !== filmEnd ||
      coarse.some((s, i) => !Number.isFinite(s.time) || (i > 0 && s.time <= coarse[i - 1]!.time)) ||
      boundaries.some(b => !Number.isFinite(b.time) || b.time < filmStart || b.time > filmEnd))
    throw new Error('Missing or unordered complete-film observation bounds');
  const cache = new Map<number, ForeignObservation>();
  const read = (time: number): ForeignObservation => {
    const saved = cache.get(time); if (saved) return saved;
    const sample = observe(time, ray);
    if (sample.time !== time || !sample.names.every(name => typeof name === 'string' && name.length > 0))
      throw new Error('Actual-scene observation unavailable');
    const value = { time, names: [...new Set(sample.names)] };
    cache.set(time, value); return value;
  };
  // Re-read the actual current scene. Old coarse data is a set of seeds, not
  // authority for classification after G-J or a later source-owner change.
  for (const sample of coarse) read(sample.time);
  const seeds = coarse.map(s => read(s.time));
  const windows: [number, number][] = [];
  for (let i = 0; i < seeds.length;) {
    if (!foreign(seeds[i]!)) { i++; continue; }
    const first = i; while (i + 1 < seeds.length && foreign(seeds[i + 1]!)) i++;
    windows.push([seeds[Math.max(0, first - 1)]!.time, seeds[Math.min(seeds.length - 1, i + 1)]!.time]);
    i++;
  }
  const results: ForeignIntervalBounds[] = [];
  const boundaryAt = (time: number) => boundaries.find(boundary => boundary.time === time);
  const transition = (a: ForeignObservation, b: ForeignObservation): EdgeBracket => {
    if (foreign(a) === foreign(b) || !(b.time > a.time)) throw new Error('No actual visibility transition');
    let left = a, right = b;
    while (right.time - left.time > EDGE_RESOLUTION) {
      const mid = read((left.time + right.time) / 2);
      if (foreign(mid) === foreign(left)) left = mid; else right = mid;
    }
    return { earliest: left.time, latest: right.time, earliestForeign: foreign(left), latestForeign: foreign(right),
      kind: 'sample-transition', boundary: boundaryAt(left.time) ?? boundaryAt(right.time) };
  };
  const processed = new Set<string>();
  for (const [start, end] of windows) {
    const count = Math.max(1, Math.ceil((end - start) * HZ) + 1);
    const times = [...new Set([
      ...Array.from({ length: count + 1 }, (_, i) => i === 0 ? start : i === count ? end : start + (end - start) * i / count),
      ...seeds.filter(s => s.time >= start && s.time <= end).map(s => s.time),
      ...boundaries.filter(b => b.time >= start && b.time <= end).map(b => b.time),
    ])].sort((a, b) => a - b);
    const samples = times.map(read);
    for (let i = 0; i < samples.length;) {
      if (!foreign(samples[i]!)) { i++; continue; }
      const firstIndex = i; while (i + 1 < samples.length && foreign(samples[i + 1]!)) i++;
      const lastIndex = i, firstSample = samples[firstIndex]!, lastSample = samples[lastIndex]!;
      const key = `${firstSample.time}:${lastSample.time}`;
      if (processed.has(key)) { i++; continue; } processed.add(key);
      const before = samples[firstIndex - 1], after = samples[lastIndex + 1];
      if ((!before && firstSample.time !== filmStart) || (!after && lastSample.time !== filmEnd))
        throw new Error('Foreign interval is not bounded by clear samples or a film endpoint');
      const first: EdgeBracket = before ? transition(before, firstSample) :
        { earliest: filmStart, latest: filmStart, earliestForeign: true, latestForeign: true, kind: 'film-start' };
      const last: EdgeBracket = after ? transition(lastSample, after) :
        { earliest: filmEnd, latest: filmEnd, earliestForeign: true, latestForeign: true, kind: 'film-end' };
      const interior = samples.slice(firstIndex, lastIndex + 1);
      const lowerDuration = Math.max(0, last.earliest - first.latest), upperDuration = last.latest - first.earliest;
      results.push({ ray, first, last, lowerDuration, upperDuration, verdict: intervalVerdict(lowerDuration, upperDuration),
        names: [...new Set([...cache.values()].filter(s => s.time >= first.earliest && s.time <= last.latest && foreign(s)).flatMap(s => s.names))], interiorSamples: interior.length,
        maximumInteriorStep: interior.reduce((max, s, j) => j === 0 ? max : Math.max(max, s.time - interior[j - 1]!.time), 0) });
      i++;
    }
  }
  return { ray, intervals: results.sort((a, b) => a.first.earliest - b.first.earliest), samples: [...cache.values()].sort((a, b) => a.time - b.time),
    hz: HZ, edgeResolution: EDGE_RESOLUTION, limit: LIMIT,
    scope: 'Actual-scene union observations. Dense seed interiors at240Hz, edge brackets<=1ms, actual phase seeks. Sub-sample gaps are not continuously certified. Only upper<=.25 passes.' };
}

import { mkdir, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error('Usage: node scripts/summarize-world-measurements.mjs REPORTER_JSON_OR_OUTPUT_DIR OUTPUT_PREFIX');
const source = resolve(input), prefix = resolve(output);
async function scan(path) {
  if (!(await stat(path)).isDirectory()) return [path];
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? scan(join(path, entry.name)) : [join(path, entry.name)]))).flat();
}
const matching = new Map();
const isMeasurement = data => data?.scope?.startsWith('world-') && Array.isArray(data.samples) && Array.isArray(data.summaries);
function collect(data) {
  if (!data || typeof data !== 'object') return;
  if (isMeasurement(data)) { matching.set(JSON.stringify(data), data); return; }
  for (const attachment of data.attachments ?? []) {
    if (attachment.name?.startsWith('world-') && attachment.body) {
      const decoded = JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8'));
      if (isMeasurement(decoded)) matching.set(JSON.stringify(decoded), decoded);
    }
  }
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') collect(value);
  }
}
for (const file of await scan(source)) {
  if (!file.endsWith('.json')) continue;
  let data;
  try { data = JSON.parse(await readFile(file, 'utf8')); } catch { continue; }
  collect(data);
}
if (!matching.size) throw new Error(`No World measurement attachments found in ${source}; run Playwright with --reporter=list,json and PLAYWRIGHT_JSON_OUTPUT_FILE set.`);
await mkdir(dirname(prefix), { recursive: true });
const rawDirectory = await mkdtemp(`${prefix}.raw-`);
const equalHashes = (a, b) => a && b && Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => b[key] === value);
const reports = [];
for (const [index, data] of [...matching.values()].entries()) {
  const file = join(rawDirectory, `${String(index + 1).padStart(2, '0')}-${data.scope.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' });
  reports.push({ attachment: file, scope: data.scope, recordedAt: data.recordedAt, workload: data.workload,
    cpuSlowdown: data.cpuSlowdown, viewport: data.viewport, host: data.host, timingLimits: data.timingLimits,
    sourceHashEquality: equalHashes(data.sourceSha256, data.sourceSha256After),
    sourceHashes: data.sourceSha256,
    samples: data.samples.map((sample, index) => {
      const before = sample.before.video, after = sample.after.video;
      return { ...data.summaries[index], drawCount: sample.draws.length, drawnAdvances: sample.drawnAdvances,
        phases: Object.fromEntries([...new Set(sample.draws.map(draw => draw.phase))].map(phase => [phase, sample.draws.filter(draw => draw.phase === phase).length])),
        qualityChanges: sample.qualityChanges, manualClock: [sample.before.manualClock, sample.after.manualClock],
        css: [[sample.before.cssWidth, sample.before.cssHeight], [sample.after.cssWidth, sample.after.cssHeight]],
        zeroGameWork: sample.stepCalls === 0 && sample.gameRenderCalls === 0 && sample.before.steps === sample.after.steps && sample.runtimeUnchanged === true && sample.fingerprintUnchanged === true,
        runtimeUnchanged: sample.runtimeUnchanged, fingerprintUnchanged: sample.fingerprintUnchanged,
        video: after ? { before, after, timeProgressSeconds: before ? after.time - before.time : null,
          totalFrameProgress: before ? after.frames - before.frames : null,
          droppedFrameProgress: before ? after.dropped - before.dropped : null,
          presentedBefore: before ? before.frames - before.dropped : null,
          presentedAfter: after.frames - after.dropped,
          presentedProgress: before ? (after.frames - after.dropped) - (before.frames - before.dropped) : null } : null };
    }) });
}
reports.sort((a, b) => a.scope.localeCompare(b.scope) || a.recordedAt.localeCompare(b.recordedAt));
const result = { input: source, rawDirectory, reportCount: reports.length, uniqueScopes: [...new Set(reports.map(report => report.scope))],
  boundary: 'Attachment summary only; does not establish test success or physical-phone performance. No thresholds added.', reports };
await writeFile(`${prefix}.json`, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
const format = d => d ? `n=${d.samples}, p50=${d.p50}, p95=${d.p95}, max=${d.max}` : 'unavailable';
const lines = ['# World measurement attachment summary', '', result.boundary, '', `Reports: ${reports.length}; unique scopes: ${result.uniqueScopes.length}.`, ''];
for (const report of reports) {
  lines.push(`## ${report.scope}`, '', `Attachment: ${report.attachment}`, '', `Workload: ${JSON.stringify(report.workload)}`, '',
    `CPU slowdown: ${report.cpuSlowdown}; viewport: ${JSON.stringify(report.viewport)}; host: ${JSON.stringify(report.host)}; source hashes equal: ${report.sourceHashEquality}.`, '');
  for (const sample of report.samples) {
    lines.push(`- Chapter ${sample.chapter}; elapsed ${sample.elapsedMs} ms; quality ${JSON.stringify(sample.qualityStart)} → ${JSON.stringify(sample.qualityEnd)}; changes ${sample.qualityChanges}.`,
      `- Draw ms: ${format(sample.drawMs)}; natural: ${format(sample.naturalDrawMs)}; requested: ${format(sample.requestedDrawMs)}.`,
      `- Advance ms: ${format(sample.advanceMs)}; frame interval ms: ${format(sample.frameMs)}.`,
      `- Stage submissions ${sample.drawCount}; phases ${JSON.stringify(sample.phases)}; calls ${format(sample.calls)}; triangles ${format(sample.triangles)}; renderer frames ${sample.rendererFrames}.`,
      `- Zero game work: ${sample.zeroGameWork}; steps ${sample.stepCalls}; game renders ${sample.gameRenderCalls}; drawn advances ${sample.drawnAdvances}.`);
    if (sample.video) lines.push(`- Video: time progress ${sample.video.timeProgressSeconds} s; total frames +${sample.video.totalFrameProgress}; dropped +${sample.video.droppedFrameProgress}; presented (total − dropped) ${sample.video.presentedBefore} → ${sample.video.presentedAfter}, progress ${sample.video.presentedProgress}.`);
    lines.push('');
  }
}
await writeFile(`${prefix}.md`, `${lines.join('\n')}\n`, { flag: 'wx' });
console.log(JSON.stringify({ reports: reports.length, rawDirectory, uniqueScopes: result.uniqueScopes, json: `${prefix}.json`, markdown: `${prefix}.md` }));

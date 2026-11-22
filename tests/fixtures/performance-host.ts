import { test as base } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

function cpuTime() {
  const aggregate = readFileSync('/proc/stat', 'utf8').split('\n', 1)[0] ?? '';
  const [label, ...values] = aggregate.trim().split(/\s+/);
  const times = values.slice(0, 8).map(Number);
  const idle = times[3];
  if (label !== 'cpu' || times.length !== 8 || idle === undefined || !times.every(Number.isFinite))
    throw new Error('Could not read the Linux host CPU counters');
  return { total: times.reduce((sum, value) => sum + value, 0), idle };
}

export const test = base.extend<{ idlePerformanceHost: void }>({
  // The fixture's separate setup timeout leaves the measured case's deadline unchanged.
  idlePerformanceHost: [async ({}, use) => {
    if (process.env.TUMBLEWORKS_WAIT_FOR_IDLE_PERFORMANCE === '1') {
      let before = cpuTime();
      let consecutive = 0;
      while (consecutive < 3) {
        await delay(20_000);
        const after = cpuTime();
        const elapsed = after.total - before.total;
        if (elapsed <= 0) throw new Error('Host CPU counters could not measure an idle window');
        const idle = (after.idle - before.idle) / elapsed * 100;
        consecutive = idle >= 75 ? consecutive + 1 : 0;
        console.log(`Host idle ${new Date().toISOString()} ${idle.toFixed(2)}% (${consecutive}/3)`);
        before = after;
      }
    }
    await use();
  }, { auto: true, timeout: 3_600_000 }],
});

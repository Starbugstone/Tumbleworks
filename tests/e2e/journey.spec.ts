import { expect, test, type Page } from '@playwright/test';

interface Snapshot {
  status: string;
  occupancy: number;
  pending: number;
  frontBox: number;
  boardId: string;
  canUndo: boolean;
}

// The hook is a dev-only global, so the test describes the part of it that it uses.
type Hook = {
  scene(): {
    sim: {
      state: { status: string; pending: unknown[]; frontBox: number };
      occupancy: number;
      canUndo: boolean;
      board: { id: string };
    };
    debugTargets(): Record<string, { x: number; y: number }>;
    children: { list: { type: string; text?: string; visible?: boolean }[] };
  };
};
const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => {
    const { sim } = (window as unknown as { tumbleworks: Hook }).tumbleworks.scene();
    return {
      status: sim.state.status,
      occupancy: sim.occupancy,
      pending: sim.state.pending.length,
      frontBox: sim.state.frontBox,
      boardId: sim.board.id,
      canUndo: sim.canUndo,
    };
  });

async function tap(page: Page, target: string): Promise<void> {
  const point = await page.evaluate((name) => (window as unknown as { tumbleworks: Hook }).tumbleworks.scene().debugTargets()[name], target);
  if (!point) throw new Error(`No tap target called ${target}`);
  await page.touchscreen.tap(point.x, point.y);
}

async function until(page: Page, check: (s: Snapshot) => boolean, what: string): Promise<Snapshot> {
  await expect.poll(async () => check(await snapshot(page)), { message: what, timeout: 45_000, intervals: [100] }).toBe(true);
  return snapshot(page);
}

const visibleText = (page: Page): Promise<string> =>
  page.evaluate(() =>
    (window as unknown as { tumbleworks: Hook }).tumbleworks
      .scene()
      .children.list.flatMap((object) => {
        const nested = (object as unknown as { list?: { type: string; text?: string }[] }).list ?? [];
        return [object, ...nested];
      })
      .filter((object) => object.type === 'Text')
      .map((object) => object.text ?? '')
      .join(' | '),
  );

test('a jam can be undone, the level won, and the win survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as { tumbleworks?: Hook }).tumbleworks?.scene()?.sim));
  expect(await snapshot(page)).toMatchObject({ boardId: 'board-1', status: 'playing', occupancy: 0, canUndo: false });

  // The guided first tap only accepts the blue packet.
  await tap(page, 'supply1');
  expect((await snapshot(page)).occupancy).toBe(0);
  await tap(page, 'supply0');
  expect((await snapshot(page)).occupancy).toBe(6);

  // Green fills the belt, red can't get on, and nothing can deliver.
  await tap(page, 'supply1');
  const jammed = await until(page, (s) => s.status === 'jammed', 'green should jam the belt');
  expect(jammed.occupancy).toBe(12);
  await until(page, (s) => s.pending === 0, 'waiting marbles should all enter');
  await expect.poll(() => visibleText(page)).toContain('Belt jammed!');

  await tap(page, 'undo');
  expect(await snapshot(page)).toMatchObject({ status: 'playing', occupancy: 6 });
  await expect.poll(() => visibleText(page)).not.toContain('Belt jammed!');

  // Red unblocks everything, then green finishes.
  await tap(page, 'supply0');
  await until(page, (s) => s.occupancy === 0 && s.frontBox === 4, 'red and blue should clear');
  await tap(page, 'supply1');
  await until(page, (s) => s.status === 'won', 'green should finish the level');
  await expect.poll(() => visibleText(page), { timeout: 5000 }).toContain('Machine clear!');

  // Completion is saved, so a reload opens the next level with the first one ticked off.
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as { tumbleworks?: Hook }).tumbleworks?.scene()?.sim));
  expect(await snapshot(page)).toMatchObject({ boardId: 'board-2', status: 'playing' });
  expect(await page.evaluate(() => localStorage.getItem('tumbleworks.progress.v1'))).toContain('board-1');

  expect(errors).toEqual([]);
});

test('a belt with no room and nothing to deliver is called a jam', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: ['board-1'] })));
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as { tumbleworks?: Hook }).tumbleworks?.scene()?.sim));
  expect((await snapshot(page)).boardId).toBe('board-2');

  await tap(page, 'supply1'); // yellow
  await tap(page, 'supply2'); // green: belt now 12/12 with neither able to deliver
  expect(await snapshot(page)).toMatchObject({ occupancy: 12, status: 'jammed' });
  await tap(page, 'supply0');
  expect((await snapshot(page)).occupancy).toBe(12);
  await expect.poll(() => visibleText(page), { timeout: 15_000 }).toContain('Belt jammed!');
});

test('a tap with too little room is refused and says why', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: ['board-1'] })));
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as { tumbleworks?: Hook }).tumbleworks?.scene()?.sim));

  // Red delivers at once and yellow waits, so the belt fills up but can still drain.
  await tap(page, 'supply0');
  await tap(page, 'supply1');
  await tap(page, 'supply2');
  const refused = await snapshot(page);
  expect(refused).toMatchObject({ occupancy: 12, status: 'playing' });
  await expect.poll(() => visibleText(page)).toContain('Needs 6 free spaces');
});

import { expect, test, type Page } from '@playwright/test';

interface Snapshot {
  status: string;
  occupancy: number;
  activeBox: number;
  boardId: string;
  pouring: number;
}

// The hook is a dev-only global, so the test describes the part of it that it uses.
type Hook = {
  app: {
    boardIndex: number;
    machine: {
      board: { id: string };
      rules: {
        status: string;
        occupancy: number;
        activeBox: number;
        state: { marbles: { status: string }[] };
      };
    };
    debugTargets(): Record<string, { x: number; y: number }>;
  };
};
const app = (): Hook['app'] => (window as unknown as { tumbleworks: Hook }).tumbleworks.app;

const ready = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => Boolean((window as unknown as { tumbleworks?: Partial<Hook> }).tumbleworks?.app?.machine), undefined, {
    timeout: 60_000,
  });

const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => {
    const { machine } = (window as unknown as { tumbleworks: Hook }).tumbleworks.app;
    return {
      status: machine.rules.status,
      occupancy: machine.rules.occupancy,
      activeBox: machine.rules.activeBox,
      boardId: machine.board.id,
      pouring: machine.rules.state.marbles.filter((marble) => marble.status === 'pouring').length,
    };
  });

async function tap(page: Page, target: string): Promise<void> {
  const point = await page.evaluate((name) => (window as unknown as { tumbleworks: Hook }).tumbleworks.app.debugTargets()[name], target);
  if (!point) throw new Error(`No tap target called ${target}`);
  await page.touchscreen.tap(point.x, point.y);
}

async function until(page: Page, check: (s: Snapshot) => boolean, what: string): Promise<Snapshot> {
  await expect.poll(async () => check(await snapshot(page)), { message: what, timeout: 90_000, intervals: [150] }).toBe(true);
  return snapshot(page);
}

test('a jam can be undone, the level won, and the win survives a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await ready(page);
  expect(await snapshot(page)).toMatchObject({ boardId: 'board-1', status: 'playing', occupancy: 0 });
  await expect(page.locator('.chip[data-level="1"]')).toBeDisabled();
  await expect(page.locator('#undo')).toBeDisabled();

  // The guided first tap only accepts the blue tray.
  await tap(page, 'supply1');
  expect((await snapshot(page)).occupancy).toBe(0);
  await tap(page, 'supply0');
  expect((await snapshot(page)).occupancy).toBe(6);

  // Green fills the belt, red can't get on, and nothing can deliver.
  await tap(page, 'supply1');
  expect(await snapshot(page)).toMatchObject({ status: 'jammed', occupancy: 12 });
  await expect(page.locator('#card-title')).toHaveText('Belt jammed!', { timeout: 60_000 });

  await tap(page, 'undo');
  expect(await snapshot(page)).toMatchObject({ status: 'playing', occupancy: 6 });
  await expect(page.locator('#card')).toBeHidden();

  // Red unblocks everything, then green finishes.
  await tap(page, 'supply0');
  await until(page, (s) => s.activeBox === 4 && s.occupancy === 0, 'red and blue should clear');
  await tap(page, 'supply1');
  await until(page, (s) => s.status === 'won', 'green should finish the level');
  await expect(page.locator('#card-title')).toHaveText('Machine clear!', { timeout: 15_000 });

  // Completion is saved, so a reload opens the next level with the first one ticked off.
  await page.reload();
  await ready(page);
  expect(await snapshot(page)).toMatchObject({ boardId: 'board-2', status: 'playing' });
  await expect(page.locator('.chip[data-level="0"]')).toHaveText('✓');

  expect(errors).toEqual([]);
});

test('a belt with no room and nothing to deliver is called a jam', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: ['board-1'] })));
  await page.reload();
  await ready(page);
  expect((await snapshot(page)).boardId).toBe('board-2');

  await tap(page, 'supply1'); // yellow
  await tap(page, 'supply2'); // green
  expect(await snapshot(page)).toMatchObject({ occupancy: 12, status: 'jammed' });
  await expect(page.locator('#card-title')).toHaveText('Belt jammed!', { timeout: 60_000 });
});

test('a tap with too little room is refused and says why', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: ['board-1'] })));
  await page.reload();
  await ready(page);

  // Red can still deliver and yellow waits, so the belt fills up but can drain.
  await tap(page, 'supply0');
  await tap(page, 'supply1');
  await tap(page, 'supply2');
  expect(await snapshot(page)).toMatchObject({ occupancy: 12, status: 'playing' });
  await expect(page.locator('#message')).toContainText('Needs 6 free spaces');
});

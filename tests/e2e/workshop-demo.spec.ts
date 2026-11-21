import { expect, test } from '@playwright/test';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { CAMPAIGN, PLAY_ORDER } from '../../src/campaign';
import { worldProgress } from '../../src/world/progression';

test.use({ viewport: { width: 375, height: 690 }, deviceScaleFactor: 1 });

test('the Wi-Fi demo opens the registered boards and keeps a win in the demo save', async ({ page }) => {
  const completed = CAMPAIGN.slice(0,45).map(level => level.id);
  const chapter = worldProgress(CAMPAIGN, new Set(completed)).chapters[0]!;
  const original = {
    'tumbleworks.progress.v1': JSON.stringify({ completed, muted: true, current: CAMPAIGN[45]!.id }),
    'tumbleworks.preferences.v1': JSON.stringify({ locale: 'fr', guides: ['tube-1'] }),
    'tumbleworks.valley.v1': JSON.stringify({ seen: [chapter.key], chapter: 1 }),
  };
  await page.addInitScript(values => {
    if (sessionStorage.getItem('fixture-seeded')) return;
    for (const [key,value] of Object.entries(values)) localStorage.setItem(key,value);
    sessionStorage.setItem('fixture-seeded','true');
  }, original);
  const openCampaign = async () => {
    await page.goto('/');
    await expect(page.locator('#boot')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('html')).toHaveAttribute('data-village', 'glasshouse-gardens');
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
    const actual = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key,localStorage.getItem(key)])), Object.keys(original));
    expect(actual).toEqual(original);
  };
  await openCampaign();
  await page.goto('/demo.html');
  await page.getByRole('link', { name: 'All levels' }).tap();
  const levels = Object.values(PLAY_ORDER).flat().length;
  await expect(page.locator('#chips .chip')).toHaveCount(levels, { timeout: 60_000 });
  await expect(page.locator('#chips [aria-disabled="true"]')).toHaveCount(0);
  await page.locator('#chips .chip').last().tap();
  await expect(page.locator('#level-name')).toContainText(String(levels));
  await page.locator('#levels-toggle').tap();
  await page.locator('#map-open').tap();
  await expect(page.getByRole('link', { name: 'Tube Sort' })).toBeVisible();

  await page.goto('/?demo=tube-1');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 60_000 });
  const tubes = [[106,155], [255,155], [104,319], [261,319], [182,499]] as const;
  const lesson = TUBE_BOARDS.find(board => board.id === 'tube-1')!;
  for (const move of lesson.solution) {
    for (const index of [move.from, move.to]) {
      const [x, y] = tubes[index]!;
      await page.touchscreen.tap(x, y);
    }
  }
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tumbleworks.progress.v1.demo') ?? '{}').completed), { timeout: 30_000 }).toContain('tube-1');
  await page.getByRole('button', { name: 'Back to demos' }).tap();
  await page.waitForURL('**/demo.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'Little Harbour' })).toBeVisible();
  await openCampaign();
});

for (const finish of [0, 1]) test(`Little Harbour draws its buildings in the film and map with fx=${finish}`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?demo=harbour&fx=' + finish);
  await expect(page.locator('#boot')).toBeHidden({ timeout: 120_000 });
  await expect(page.locator('#scene')).toHaveAttribute('data-world-film','ready',{timeout:120_000});
  for (const screen of ['film','map']) {
    if (screen === 'map') await page.locator('#film-skip').tap();
    await expect(page.locator('body')).toHaveAttribute('data-screen',screen);
    await expect(page.locator('#journey-transition')).toBeHidden();
    await expect.poll(async () => {
      const png = (await page.screenshot()).toString('base64');
      return page.evaluate(async data => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + data;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 375; canvas.height = 690;
        const context = canvas.getContext('2d')!;
        context.drawImage(img,0,0,375,690);
        const pixels = context.getImageData(0,85,375,515).data;
        let terracotta = 0;
        for (let i=0;i<pixels.length;i+=4) {
          const r=pixels[i]!, g=pixels[i+1]!, b=pixels[i+2]!;
          if (r>95 && r>g*1.48 && r>b*1.65 && g>b*.85) terracotta++;
        }
        return terracotta;
      },png);
    }, {message:'sunlit roofs and tower paint are visible above the water',timeout:20_000}).toBeGreaterThan(300);
    expect(errors).toEqual([]);
  }
});


test('the staggered five-tube rack accepts a cross-row drag and its complete solution', async ({ page }) => {
  await page.goto('/?demo=tube-41');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 60_000 });
  const tubes = [[108, 154], [257, 154], [182, 318], [100, 499], [264, 499]] as const;
  const moves = TUBE_BOARDS.find(board => board.id === 'tube-41')!.solution;
  const touch = await page.context().newCDPSession(page);
  const [startX, startY] = tubes[moves[0]!.from]!;
  const [endX, endY] = tubes[moves[0]!.to]!;
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY }] });
  for (const t of [.25, .5, .75, 1]) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
      { x: startX + (endX - startX) * t, y: startY + (endY - startY) * t },
    ] });
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#undo')).toBeEnabled();
  for (const move of moves.slice(1)) {
    for (const index of [move.from, move.to]) {
      const [x, y] = tubes[index]!;
      await page.touchscreen.tap(x, y);
    }
  }
  await expect(page.locator('#load')).toHaveText(/4\s*\/\s*4/);
  await expect(page.locator('#card[data-kind="win"]')).toBeVisible({ timeout: 60_000 });
  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem('tumbleworks.progress.v1.demo') ?? '{}').completed
  )).toContain('tube-41');
});

test('cold and warm demo navigation shares a document and returns to its island', async ({ page }) => {
  const errors: string[] = [];
  const downloaded: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => downloaded.push(request.url()));
  await page.goto('/demo.html');
  const tube = page.getByRole('link', { name: 'Tube Sort', exact: true });
  await expect(tube).toBeVisible();
  const origin = await page.evaluate(() => performance.timeOrigin);
  expect(downloaded.some(url => /(?:three\.js|rapier|\/src\/main\.ts|\/assets\/main-[\w-]+\.js)/.test(url))).toBe(false);
  await tube.tap();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 60_000 });
  await expect(page.locator('#level-name')).toContainText('Tube Sort');
  await page.locator('#levels-toggle').tap();
  await page.goBack();
  await expect(page.locator('#levels')).toBeHidden();
  await expect(page.locator('#level-name')).toContainText('Tube Sort');
  await page.goBack();
  await expect(tube).toBeVisible();
  await page.getByRole('link', { name: 'Funnel Sort', exact: true }).tap();
  await expect(page.locator('#level-name')).toContainText('Funnel Sort');
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
  expect(errors).toEqual([]);
});

test('the warm demo launcher opens the Little Harbour film after Tube Sort', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/demo.html');
  const origin = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole('link', { name: 'Tube Sort', exact: true }).tap();
  await expect(page.locator('#boot')).toBeHidden({ timeout: 60_000 });
  await expect(page.locator('#level-name')).toContainText('Tube Sort');
  await page.locator('#levels-toggle').tap();
  await expect(page.locator('#levels')).toBeVisible();
  await page.getByRole('button', { name: 'Back to demos', exact: true }).tap();
  await expect(page).toHaveURL(/\/demo\.html$/);

  await page.getByRole('link', { name: 'Little Harbour', exact: true }).tap();
  await expect(page).toHaveURL(/\?demo=village&island=little-harbour$/);
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'film');
  await expect(page.locator('#scene')).toHaveAttribute('data-world-film', 'ready', { timeout: 120_000 });
  await expect(page.locator('#scene')).toHaveAttribute('data-world-playback', 'realtime-3d');
  await expect(page.getByRole('button', { name: 'Play film' })).toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
  expect(errors).toEqual([]);
});

import { expect, test, type Page } from '@playwright/test';
import type { App } from '../../src/view/App';
type GameWindow = Window & { tumbleworks: { app: App } };
const state = async (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
const advance = async (page: Page, ticks: number) => page.evaluate((n) => {
  const app = (window as unknown as GameWindow).tumbleworks.app;
  for (let t=0;t<n;t++) app.advance(1/60,false);
  app.advance(0);
}, ticks);
const tap = async (page: Page, id: string) => {
  const at = await page.evaluate((key) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[key],id);
  expect(at, id).toBeDefined();
  await page.touchscreen.tap(at!.x,at!.y);
};
test.use({ viewport:{width:375,height:690},deviceScaleFactor:1 });
for (const id of [200,201,202]) test(`Funnel Sort ${id}: real phone input, rapid releases, undo, language and desktop`,async({page})=>{
  const errors:string[]=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(`/?try=board-${id}`);
  await page.waitForFunction(()=> Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.evaluate(()=> { (window as unknown as GameWindow).tumbleworks.app.manualClock=true; });
  await page.locator('#restart').click();
  await advance(page,1);
  if(id===200){
    await tap(page,'hint'); await expect(page.locator('#message')).toContainText('joined');
    await tap(page,'supply0');
    expect((await state(page)).released).toEqual([0,2]);
    await tap(page,'supply4');
    expect((await state(page)).released).toEqual([0,2,4]);
    await tap(page,'undo');await tap(page,'undo');
    expect((await state(page)).released).toEqual([]);
  } else if(id===201){
    await tap(page,'supply1');
    expect((await state(page)).released).toEqual([]);
    await tap(page,'supply2');await tap(page,'supply0');
    await advance(page,1);
    await tap(page,'supply1');
    expect((await state(page)).released).toEqual([2,0,1]);
    await tap(page,'undo');
    expect((await state(page)).released).toEqual([2,0]);
  } else {
    expect((await state(page)).sealsOpen).toEqual([false]);
    for(const action of [0,2,2]){await tap(page,`supply${action}`);await advance(page,380);}
    expect((await state(page)).sealsOpen).toEqual([true]);
    await tap(page,'undo');
    expect((await state(page)).sealsOpen).toEqual([false]);
  }
  // Start on a live crate and cancel before release, then drag off the board.
  const before = (await state(page)).released;
  const at = await page.evaluate(() => Object.entries((window as unknown as GameWindow).tumbleworks.app.debugTargets()).find(([key]) => key.startsWith('supply'))?.[1]);
  expect(at).toBeDefined();
  const input = await page.context().newCDPSession(page);
  await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:at!.x,y:at!.y,id:7}]});
  await input.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  expect((await state(page)).released).toEqual(before);
  await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:at!.x,y:at!.y,id:8}]});
  await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:370,y:400,id:8}]});
  await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect((await state(page)).released).toEqual(before);
  await page.locator('#levels-toggle').click(); await page.locator('#language-fr').click(); await page.locator('#levels-toggle').click();
  await tap(page,'hint');
  await expect(page.locator('#message')).not.toBeEmpty();
  await page.screenshot({path:`output/current/funnel-rules/board-${id}-phone.png`});
  await page.addStyleTag({content:'canvas { filter: grayscale(1); }'});
  await page.screenshot({path:`output/current/funnel-rules/board-${id}-gray.png`});
  await page.setViewportSize({width:1280,height:800});await advance(page,1);
  await page.screenshot({path:`output/current/funnel-rules/board-${id}-desktop.png`});
  expect(errors).toEqual([]);
});

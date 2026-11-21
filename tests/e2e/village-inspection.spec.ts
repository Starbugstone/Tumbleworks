import { expect, test, type Page } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import type { WorldScene } from '../../src/view/world-scene';
import type { Stage } from '../../src/engine/stage';
import { WORKSHOP_PROJECTS } from '../../src/world/workshop-projects';
import type { Mesh } from 'three';

type InspectionWindow = Window & { tumbleworks: { app: { manualClock:boolean; advance(seconds:number):boolean; stage:Stage; world: { scene: WorldScene; mode:string } } } };
const pose=(page:Page)=>page.evaluate(()=>{
  const scene=(window as unknown as InspectionWindow).tumbleworks.app.world.scene;
  return {yaw:scene.orbit.yaw,elevation:scene.orbit.elevation,zoom:scene.orbit.zoom,pan:scene.orbit.pan.toArray(),camera:scene.camera.matrixWorld.toArray(),mode:scene.cameraMode};
});
async function ready(page:Page):Promise<void>{
  await expect(page.locator('canvas[data-world-scene="ready"]')).toBeVisible({timeout:120_000});
  await expect(page.locator('#journey-transition')).toBeHidden();
  await page.evaluate(()=>{(window as unknown as InspectionWindow).tumbleworks.app.manualClock=true;});
}
async function draw(page:Page):Promise<void>{await page.evaluate(()=>{(window as unknown as InspectionWindow).tumbleworks.app.advance(1/60);});}
const idleFrames = (page: Page) => page.evaluate(() => {
  const app = (window as unknown as InspectionWindow).tumbleworks.app;
  const before = app.stage.renderer.info.render.frame;
  for (let i = 0; i < 60; i++) app.advance(1 / 60);
  return app.stage.renderer.info.render.frame - before;
});
const saveState = (page: Page) => page.evaluate(() => [
  localStorage.getItem('tumbleworks.progress.v1'), localStorage.getItem('tumbleworks.valley.v1'),
]);

test('native touch orbits from a marker, pinches, pans, cancels and resets without replaying a level',async({page}, testInfo)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(completed=>localStorage.setItem('tumbleworks.progress.v1',JSON.stringify({completed,muted:true})),CAMPAIGN.slice(0,30).map(l=>l.id));
  await page.goto('/?fx=0');await ready(page);
  await page.getByRole('button',{name:'Previous location',exact:true}).tap();await ready(page);
  const initial=await pose(page),save=await saveState(page);
  const client=await page.context().newCDPSession(page);
  const marker=await page.locator('.map-stop[data-status="built"]:visible').first().boundingBox();expect(marker).not.toBeNull();
  const x=marker!.x+marker!.width/2,y=marker!.y+marker!.height/2;
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(let step=1;step<=5;step++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+step*18,y:y+step*3,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await draw(page);
  expect(await pose(page)).toMatchObject({mode:'map'});expect((await pose(page)).yaw).toBeGreaterThan(initial.yaw+.6);
  await expect(page.locator('body')).toHaveAttribute('data-screen','map');
  const before=await pose(page);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:130,y:320,id:1},{x:240,y:320,id:2}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:90,y:340,id:1},{x:290,y:340,id:2}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await draw(page);
  expect((await pose(page)).zoom).toBeGreaterThan(before.zoom*1.6);expect((await pose(page)).pan).not.toEqual(before.pan);
  const held=await pose(page);for(let i=0;i<60;i++)await draw(page);expect(await pose(page)).toEqual(held);
  await page.getByRole('button',{name:'Reset village view'}).tap();await draw(page);expect(await pose(page)).toEqual(initial);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:260,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:150,y:280,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await draw(page);
  await expect(page.locator('#world')).not.toHaveClass(/wv-inspecting/);
  await page.getByRole('button',{name:'Reset village view'}).tap();await draw(page);
  await page.screenshot({path:testInfo.outputPath('phone.png')});
  const awakeFrames = await idleFrames(page);
  expect(awakeFrames).toBeGreaterThan(0);
  expect(awakeFrames).toBeLessThanOrEqual(20);
  expect(await pose(page)).toEqual(initial);
  expect(await saveState(page)).toEqual(save);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await draw(page);
  expect(await idleFrames(page)).toBe(0);
  expect(await pose(page)).toEqual(initial);
  expect(await saveState(page)).toEqual(save);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.keyboard.press('ArrowRight');await draw(page);const inspection=await pose(page);
  await page.getByRole('button',{name:'Film · Watch your machine',exact:true}).tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen','film');
  await page.locator('#film-skip').tap();await expect(page.locator('#journey-transition')).toBeHidden();await draw(page);
  expect(await pose(page)).toEqual(inspection);
  await page.locator('.map-stop[data-status="built"]:visible').first().tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen','game');expect(errors).toEqual([]);
});

test('all six islands and earned buildings render through an orbit sweep',async({page}, testInfo)=>{
  test.setTimeout(360_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  // Three.js reports failed GPU programs through the console. A map may still draw its sea and pins.
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('THREE.WebGLProgram')) errors.push(message.text());
  });
  await page.addInitScript(completed=>localStorage.setItem('tumbleworks.progress.v1',JSON.stringify({completed,muted:true})),[...CAMPAIGN.map(l=>l.id),...WORKSHOP_PROJECTS.map(p=>p.id)]);
  await page.goto('/?fx=0');await ready(page);
  for(let chapter=5;chapter>=0;chapter--){
    await ready(page);await draw(page);await expect(page.getByRole('button',{name:'Reset village view'})).toBeHidden();
    const blockedPins=await page.locator('.map-stop[data-status="built"]:visible').evaluateAll(buttons=>buttons.filter(button=>{const r=button.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')!==button;}).map(button=>button.getAttribute('data-round')));
    expect(blockedPins).toEqual([]);
    const landmark = ['harbour-beacon', 'palm-house', 'grain-barn', 'civic-clock', 'fell-cottage', 'bottle-kiln'][chapter]!;
    const projects = WORKSHOP_PROJECTS.filter(project => project.chapter === chapter).map(project => `project-${project.id}`);
    const census = await page.evaluate(({ chapter, landmark, projects }) => {
      const app = (window as unknown as InspectionWindow).tumbleworks.app;
      const world = app.world.scene;
      const landscape = world.scene.getObjectByName(`village-landscape-${chapter}`);
      const site = landscape?.getObjectByName(landmark);
      const baked = landscape?.children.find(child => 'geometry' in child) as Mesh | undefined;
      const positions = baked?.geometry.getAttribute('position');
      const surface = baked?.geometry.getAttribute('terrainSurface');
      const coast = baked?.geometry.userData['coastalDressing'];
      let landmarkVertices = 0;
      if (site && positions && coast) {
        // The site group remains after batching. Require raised prop geometry beside it in the drawn layer.
        for (let i = 0; i < coast.first; i++) {
          if (surface?.getX(i) === 0 && positions.getY(i) > site.position.y + .4 &&
              Math.abs(positions.getX(i) - site.position.x) < site.scale.x &&
              Math.abs(positions.getZ(i) - site.position.z) < site.scale.z) landmarkVertices++;
        }
      }
      const missingProjects = projects.filter(name => !world.scene.getObjectByName(name)?.children.some(child => 'geometry' in child));
      const { calls, triangles } = app.stage.renderer.info.render;
      return { calls, triangles, coast: world.coastalDressing.beachCount, landmarkVertices, missingProjects };
    }, { chapter, landmark, projects });
    expect(census.coast, `chapter ${chapter} coast`).toBeGreaterThan(0);
    expect(census.landmarkVertices, `${landmark} in chapter ${chapter}`).toBeGreaterThan(0);
    expect(census.missingProjects).toEqual([]);
    expect(census.triangles, `chapter ${chapter}`).toBeLessThanOrEqual(36_544);
    expect(census.calls, `chapter ${chapter}`).toBeLessThanOrEqual(30);
    await page.screenshot({path:testInfo.outputPath(`island-${chapter}.png`)});
    for(const elevation of [32,65])for(let yaw=0;yaw<8;yaw++){
      await page.evaluate(({yaw,elevation})=>{const scene=(window as unknown as InspectionWindow).tumbleworks.app.world.scene;scene.orbit.yaw=yaw*Math.PI/4;scene.orbit.elevation=elevation*Math.PI/180;scene.inspect();scene.draw();},{yaw,elevation});
      if(yaw%2===0)await page.screenshot({path:testInfo.outputPath(`sweep-${chapter}-${elevation}-${yaw}.png`)});
    }
    if(chapter>0)await page.getByRole('button',{name:'Previous location',exact:true}).tap();
  }
  expect(errors).toEqual([]);
});


test('French reduced-motion inspection and desktop wheel zoom stay direct and bounded',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(completed=>{localStorage.setItem('tumbleworks.progress.v1',JSON.stringify({completed,muted:true}));localStorage.setItem('tumbleworks.preferences.v1',JSON.stringify({locale:'fr',guides:[]}));},CAMPAIGN.slice(0,30).map(l=>l.id));
  await page.goto('/?fx=0');await ready(page);const initial=await pose(page);
  await page.keyboard.press('ArrowLeft');await draw(page);const rotated=await pose(page);
  expect(rotated.yaw).toBeLessThan(initial.yaw);for(let i=0;i<30;i++)await draw(page);expect(await pose(page)).toEqual(rotated);
  await page.getByRole('button',{name:'Recentrer le village'}).tap();await draw(page);expect(await pose(page)).toEqual(initial);
  await page.screenshot({path:'output/current/tropical-village/phone-fr-reduced.png'});
  await page.setViewportSize({width:1280,height:800});await draw(page);
  await page.mouse.move(640,380);await page.mouse.wheel(0,-300);await draw(page);expect((await pose(page)).zoom).toBeGreaterThan(1);
  await page.getByRole('button',{name:'Recentrer le village'}).click();await draw(page);expect((await pose(page)).zoom).toBe(1);
  await page.screenshot({path:'output/current/tropical-village/desktop.png'});
});

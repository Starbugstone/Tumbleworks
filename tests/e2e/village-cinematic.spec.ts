import {test,expect,type Page} from '@playwright/test';
import {CAMPAIGN} from '../../src/campaign';
import type {App} from '../../src/view/App';
import {mkdirSync,writeFileSync} from 'node:fs';

const output=`output/current/village-cinematic/browser/${process.env.CINE_RUN_LABEL??'latest'}`;
type WindowGame=Window&{tumbleworks:{app:App}};
async function read(page:Page){return page.evaluate(()=>{
 const app=(window as unknown as WindowGame).tumbleworks.app;
 const world=(app as unknown as {world:{filmTime:number;scene:import('../../src/view/world-scene').WorldScene|null;playback:{duration:number}|null}}).world;
 const scene=world.scene;
 return{state:app.debugState(),chapter:scene?.chapter,time:world.filmTime,duration:world.playback?.duration,routeDuration:scene?.machine.route.duration,mode:scene?.machine.route.mode,physicalProgram:!!scene?.machine.program,entities:app.stage.marbles.count,steps:app.runtime.game.steps,fingerprint:app.runtime.game.fingerprint(),progress:localStorage.getItem('tumbleworks.progress.v1'),manual:app.manualClock};
});}
test.use({viewport:{width:375,height:690},deviceScaleFactor:1});
for(let chapter=0;chapter<6;chapter++)for(const reduced of[false,true])test(`cinematic ${chapter}: phone ${reduced?'reduced':'normal'} and desktop replay`,async({page})=>{
 test.setTimeout(240000);mkdirSync(output,{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
 // Disposable presentation fixture; this does not claim actual puzzle or project wins.
 await page.addInitScript(ids=>localStorage.setItem('tumbleworks.progress.v1',JSON.stringify({completed:ids,muted:true})),CAMPAIGN.map(l=>l.id));
 await page.goto('/');await expect(page.locator('#boot')).toBeHidden({timeout:120000});await expect(page.locator('#scene')).toHaveAttribute('data-world-scene','ready',{timeout:120000});await expect(page.locator('#journey-transition')).toBeHidden();
 let shown=(await read(page)).chapter!;while(shown>chapter){await page.getByRole('button',{name:'Previous location',exact:true}).tap();await expect.poll(async()=> (await read(page)).chapter,{timeout:30000}).toBe(shown-1);shown--;await expect(page.locator('#journey-transition')).toBeHidden();}
 const baseline=await read(page);const label=`${chapter}-${reduced?'reduced':'normal'}`,snapshots=[];
 await page.getByRole('button',{name:'Watch your machine'}).tap();await expect(page.locator('#scene')).toHaveAttribute('data-world-film','ready',{timeout:30000});
 const initial=await read(page);expect(initial.mode).toBe('cinematic');expect(initial.physicalProgram).toBe(false);
 if(reduced){await page.waitForTimeout(250);expect((await read(page)).time).toBe(0);await page.getByRole('button',{name:'Play film',exact:true}).tap();}
 const natural=process.env.CINEMATIC_NATURAL==='1';
 if(!natural)await page.evaluate(()=>{(window as unknown as WindowGame).tumbleworks.app.manualClock=true;});
 for(const fraction of[0,.2,.4,.6,.8,.97]){
  const target=initial.routeDuration!*fraction;
  if(natural)await expect.poll(async()=>{const s=await read(page);return s.state.screen==='map'?initial.duration!:s.time;},{timeout:120000,intervals:[500]}).toBeGreaterThanOrEqual(target);
  else await page.evaluate(target=>{const app=(window as unknown as WindowGame).tumbleworks.app,world=(app as unknown as {world:{filmTime:number}}).world;app.advance(Math.max(0,target-world.filmTime));},target);
  const s=await read(page);expect(s.steps).toBe(baseline.steps);expect(s.fingerprint).toBe(baseline.fingerprint);expect(s.progress).toBe(baseline.progress);if(natural)expect(s.manual).toBe(false);snapshots.push(s);
  await page.screenshot({path:`${output}/${label}-phone-${fraction}.png`});
 }
 if(natural)await expect(page.locator('body')).toHaveAttribute('data-screen','map',{timeout:90000});
 else{await page.locator('#film-skip').tap();await expect(page.locator('body')).toHaveAttribute('data-screen','map');}
 await expect(page.locator('#journey-transition')).toBeHidden();expect((await read(page)).entities).toBe(baseline.entities);
 await page.setViewportSize({width:1280,height:800});await page.evaluate(()=>{(window as unknown as WindowGame).tumbleworks.app.manualClock=true;});
 await page.getByRole('button',{name:'Watch your machine'}).tap();await expect(page.locator('#scene')).toHaveAttribute('data-world-film','ready');if(reduced)await page.getByRole('button',{name:'Play film',exact:true}).tap();
 for(const fraction of[.1,.35,.65,.9]){await page.evaluate(target=>{const app=(window as unknown as WindowGame).tumbleworks.app,world=(app as unknown as {world:{filmTime:number}}).world;app.advance(Math.max(0,target-world.filmTime));},initial.routeDuration!*fraction);await page.screenshot({path:`${output}/${label}-desktop-${fraction}.png`});}
 await page.locator('#film-skip').tap();await expect(page.locator('body')).toHaveAttribute('data-screen','map');expect(errors).toEqual([]);
 writeFileSync(`${output}/${label}.json`,JSON.stringify({natural,fixture:'campaign IDs only; no project wins',baseline,initial,snapshots,final:await read(page),errors},null,2));
});

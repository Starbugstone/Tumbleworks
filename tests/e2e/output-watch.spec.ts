import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type WebSocket } from '@playwright/test';
test.use({trace:'off'});
test('generated captures and archives never send a live-reload message',async({page})=>{
  const sockets:WebSocket[]=[];
  page.on('websocket',socket=>sockets.push(socket));
  await page.goto('/');
  await page.waitForFunction(()=>Boolean((window as unknown as {tumbleworks?:unknown}).tumbleworks));
  await expect.poll(()=>sockets.length).toBeGreaterThan(0);
  const reloads:string[]=[];
  for(const socket of sockets) socket.on('framereceived',({payload})=>{
    const text=payload.toString();
    if(text.includes('full-reload')) reloads.push(text);
  });
  mkdirSync('output/current/watch-regression',{recursive:true});
  writeFileSync('output/current/watch-regression/capture.html',`<!doctype html><p>Capture ${Date.now()}</p>`);
  writeFileSync('output/current/watch-regression/tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2022'},capture:Date.now()}));
  await new Promise(resolve=>setTimeout(resolve,3000));
  expect(reloads).toEqual([]);
});

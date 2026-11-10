import { expect, it, vi } from 'vitest';
import type { Stage } from '../../src/engine/stage';
import { WorldFilm } from '../../src/view/world-film';
import { villageWorld } from './village-world-fixture';
import { InlineProofBackend } from './static-proof-inline';
it.each([0,1])('refuses any film render before EVERY rendered scene is accepted, chapter %i',chapter=>{
 const current=villageWorld(chapter,false,'held'),previous=chapter? villageWorld(0,false,'held'):null;
 const proof=previous??current,film=new WorldFilm({}as Stage,chapter,current.world,previous?.world??null);
 try{expect(film.readiness()).toBe('pending');expect(film.begin()).toBe(false);expect(()=>film.render(0)).toThrow(/not confirmed/);proof.world.activateProof();proof.scheduler.drain();(proof.proof as InlineProofBackend).flush();proof.scheduler.drain();expect(film.readiness()).toBe('ready');expect(film.begin()).toBe(true);film.render(0);expect(current.probe.marble).not.toBeNull();}finally{film.dispose();current.dispose();previous?.dispose();}
},60000);
it('film begins with a deep live native check after a prior accepted certificate',()=>{const quiet=vi.spyOn(console,'error').mockImplementation(()=>{}),f=villageWorld(0),film=new WorldFilm({}as Stage,0,f.world,null);try{const i=f.probe.machine.staticSupportInspection()!,range=i.native[0]!;
 // Obtain the actual native owner through its issued range, never a name match.
 const s=nativeSource(range),a=s.mesh.geometry.getAttribute('position').array,old=a[0]!;a[0]=old+1;expect(film.begin()).toBe(false);expect(()=>film.render(0)).toThrow();a[0]=old;expect(film.readiness()).toBe('failed');}finally{film.dispose();f.dispose();quiet.mockRestore();}},60000);
import{nativeSource}from'../../src/view/static-support-native';

it('preserves current Mill authoring status and its refused physical requirement',()=>{const f=villageWorld(2);try{expect(f.probe.machine.route.motionStatus.state).toBe('authoring');expect(()=>f.probe.machine.route.requirePhysical()).toThrow();}finally{f.dispose();}});

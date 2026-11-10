import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as terrain from '../../src/view/village-terrain';
import { WorldScene } from '../../src/view/world-scene';
import type { Stage } from '../../src/engine/stage';
import { MarbleFactory } from '../../src/engine/marbles';
function stage():Stage{return{createScene:()=>new THREE.Scene(),disposeScene:(s:THREE.Scene)=>{s.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});s.clear();},marbles:new MarbleFactory()}as unknown as Stage;}
it('releases its own material even when cancellation precedes attachment of any mesh',()=>{
 const release=vi.spyOn(THREE.Material.prototype,'dispose'),original=WorldScene.prototype.dispose;let material:THREE.Material|undefined;
 const owner=vi.spyOn(WorldScene.prototype,'dispose').mockImplementation(function(this:WorldScene){material=(this as unknown as{material:THREE.Material}).material;original.call(this);});
 try{const g=WorldScene.construct(stage(),0);expect(g.next().done).toBe(false);g.return(undefined as never);expect(material).toBeInstanceOf(THREE.Material);expect(release.mock.instances).toContain(material);}finally{owner.mockRestore();release.mockRestore();}
});
it('releases the unattached baked land and ground when native terrain binding fails',()=>{
 const host=stage();
 const created=new Set<THREE.BufferGeometry>(),disposed=new Set<THREE.BufferGeometry>(),set=THREE.BufferGeometry.prototype.setAttribute,drop=THREE.BufferGeometry.prototype.dispose;
 const allocation=vi.spyOn(THREE.BufferGeometry.prototype,'setAttribute').mockImplementation(function(this:THREE.BufferGeometry,...args){created.add(this);return set.apply(this,args);}),release=vi.spyOn(THREE.BufferGeometry.prototype,'dispose').mockImplementation(function(this:THREE.BufferGeometry){disposed.add(this);return drop.call(this);}),bind=vi.spyOn(terrain,'bindNativeTerrain').mockImplementation(()=>{throw Error('injected native bind failure');});
 try{const g=WorldScene.construct(host,0);expect(()=>{for(;;){const n=g.next();if(n.done)break;}}).toThrow(/injected native bind/);expect(created.size).toBeGreaterThan(10);expect([...created].filter(x=>!disposed.has(x))).toEqual([]);}finally{allocation.mockRestore();release.mockRestore();bind.mockRestore();}
});

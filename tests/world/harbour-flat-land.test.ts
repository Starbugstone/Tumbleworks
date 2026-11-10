import{expect,it}from'vitest';import{villageScenePlan}from'../../src/world/village-plans';import{compileTerrain,terrainHeightAt}from'../../src/world/village-terrain';import{villageTerrainGeometry}from'../../src/view/village-terrain';import{proveHarbourFlat}from'./harbour-flat-proof';
it('Harbour opt-in measures at least 976 exact same-surface triangles without changing query fields or unselected bytes',()=>{
 const source=villageScenePlan(0).terrain;expect(source.mergeFlatLand).toBe(true);const plain={...source,mergeFlatLand:false},a=compileTerrain(plain),b=compileTerrain(source),g=villageTerrainGeometry(a),h=villageTerrainGeometry(b);
 try{expect({...a,spec:undefined}).toEqual({...b,spec:undefined});const proof=proveHarbourFlat(g,h,b);expect(proof.savedTriangles).toBeGreaterThanOrEqual(976);g.computeBoundingBox();h.computeBoundingBox();expect(h.boundingBox).toEqual(g.boundingBox);expect(h.boundingSphere).toEqual(g.boundingSphere);
 for(let row=0;row<a.rows;row++)for(let col=0;col<a.columns;col++)for(const [u,v]of[[0,0],[.37,.61],[1,1]]){const x=a.originX+(col+u!)*a.cellWidth,z=a.originZ+(row+v!)*a.cellDepth;expect(Object.is(terrainHeightAt(a,x,z),terrainHeightAt(b,x,z))).toBe(true);}
 const run=h.userData.flatLandRuns[0],bad=h.clone();bad.userData={...h.userData,flatLandRuns:[{...run,lastColumn:run.lastColumn+1},...h.userData.flatLandRuns.slice(1)]};try{expect(()=>proveHarbourFlat(g,bad,b)).toThrow();}finally{bad.dispose();}
 for(const name of['color','position']){const altered=g.clone(),attribute=altered.getAttribute(name),i=run.sourceStarts[1];attribute.setComponent(i,name==='position'?1:0,attribute.getComponent(i,name==='position'?1:0)+.001);try{expect(()=>proveHarbourFlat(altered,h,b)).toThrow();}finally{altered.dispose();}}
 }finally{g.dispose();h.dispose();}
});

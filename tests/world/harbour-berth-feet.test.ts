import{expect,it}from'vitest';
import{captureHarbourPiles105}from'./harbour-pile105';
import{completeFoot105}from'./complete-foot105';
// Replaces the old2mm groundFoundations/mesh-name selector. Its historical
// failure and original source remain frozen in105/107; oracle controls retain
// the separated-y, omitted and tiny-facet negatives.
it('Harbour berth receiver piles meet actual terrain over their complete native bottoms',()=>{
 const f=captureHarbourPiles105();try{const rows=f.rows.filter(r=>r.owner==='station-0-0'||r.owner==='station-0-1');expect(rows).toHaveLength(2);for(const r of rows)expect(completeFoot105(r.input).clear).toBe(true);}finally{f.dispose();}
});

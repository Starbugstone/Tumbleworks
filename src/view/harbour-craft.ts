import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

type Point = readonly [number, number, number];

/** Small painted wooden models. Each face has its own paint and crease normal, then bakes into the village draw. */
class PaintedFaces {
  readonly vertices: number[] = [];
  readonly colours: number[] = [];
  private readonly tint = new Color();

  triangle(a: Point, b: Point, c: Point, paint: number): void {
    this.vertices.push(...a, ...b, ...c);
    this.tint.setHex(paint);
    for (let i = 0; i < 3; i++) this.colours.push(this.tint.r, this.tint.g, this.tint.b);
  }
  quad(a: Point, b: Point, c: Point, d: Point, paint: number): void {
    this.triangle(a, b, c, paint);
    this.triangle(a, c, d, paint);
  }
  /** The unexposed underside sits below ground or within the part under it. */
  block(x: number, y: number, z: number, width: number, height: number, depth: number, paint: number): void {
    const l = x - width / 2, r = x + width / 2, b = z - depth / 2, f = z + depth / 2, top = y + height;
    this.quad([l,y,f],[r,y,f],[r,top,f],[l,top,f],paint);
    this.quad([r,y,b],[l,y,b],[l,top,b],[r,top,b],paint);
    this.quad([r,y,f],[r,y,b],[r,top,b],[r,top,f],paint);
    this.quad([l,y,b],[l,y,f],[l,top,f],[l,top,b],paint);
    this.quad([l,top,f],[r,top,f],[r,top,b],[l,top,b],paint);
  }
  finish(): BufferGeometry {
    const mesh = new BufferGeometry();
    mesh.setAttribute('position', new Float32BufferAttribute(this.vertices, 3));
    mesh.setAttribute('color', new Float32BufferAttribute(this.colours, 3));
    mesh.computeVertexNormals();
    return mesh;
  }
}

const CREAM = 0xf2dfa9, BLUE = 0x315967, INK = 0x273f46, WOOD = 0xb77e4b, RED = 0xae4931;

/** A clinker fishing launch: a raked stem, broad stern, boot stripe, wheelhouse and mast. Bow points towards -X. */
export function harbourSkiff(): BufferGeometry {
  const g = new PaintedFaces();
  const stations = [
    [-1.44,.025,.54],[-1.08,.36,.45],[-.44,.54,.40],[.48,.55,.39],[1.10,.45,.41],[1.31,.33,.48],
  ] as const;
  for (let i = 1; i < stations.length; i++) {
    const [a, w, top] = stations[i-1]!, [b, v, next] = stations[i]!;
    for (const side of [-1, 1]) {
      const rings = [[.54,-.14,.54,-.14], [.93,top-.13,.93,next-.13], [1,top-.07,1,next-.07], [1,top,1,next]] as const;
      for (let k = 1; k < rings.length; k++) {
        const [w0,y0,v0,z0]=rings[k-1]!, [w1,y1,v1,z1]=rings[k]!;
        const p: Point=[a,y0,w*w0*side], q: Point=[b,z0,v*v0*side], r: Point=[b,z1,v*v1*side], s: Point=[a,y1,w*w1*side];
        const paint = [RED,BLUE,CREAM][k-1]!;
        if(side>0)g.quad(p,q,r,s,paint);else g.quad(s,r,q,p,paint);
      }
    }
    g.quad([a,top,w],[b,next,v],[b,next,-v],[a,top,-w],WOOD);
  }
  g.quad([1.31,-.12,.18],[1.31,-.12,-.18],[1.31,.48,-.33],[1.31,.48,.33],BLUE);
  g.block(.4,.40,0,.76,.39,.73,CREAM);
  g.block(.4,.79,0,.82,.07,.83,BLUE);
  for (const side of [-1,1]) {
    const z=side*.366;
    const x=[.09,.36,.44,.71];
    for(const j of [0,2]) {
      const a:Point=[x[j]!,.58,z],b:Point=[x[j+1]!,.58,z],c:Point=[x[j+1]!,.746,z],d:Point=[x[j]!,.746,z];
      if(side>0)g.quad(a,b,c,d,INK);else g.quad(d,c,b,a,INK);
    }
  }
  g.block(.50,.86,0,.115,.18,.12,RED);
  g.block(-.44,.41,0,.055,1.05,.055,WOOD);
  g.triangle([-.44,1.46,0],[-.44,1.28,0],[-.09,1.37,-.06],CREAM);
  g.triangle([-.09,1.37,-.06],[-.44,1.37,.045],[-.44,1.46,0],CREAM);
  return g.finish();
}

/** Salt-stained plaster, two pitched roof planes and shutters facing the harbour street. */
export function harbourCottage(reverse: boolean): BufferGeometry {
  const g=new PaintedFaces();
  const wall=reverse ? 0xe2b580 : 0xf3dfb4, roof=reverse ? BLUE : RED;
  g.block(0,-.035,0,1.44,.23,1.12,0x82765d);
  g.block(0,.195,0,1.36,1.10,1.04,wall);
  for(const side of [-1,1]) {
    const x=side*.68;
    const a:Point=[x,1.295,-.52],b:Point=[x,1.295,.52],c:Point=[x,1.86,0];
    if(side<0)g.triangle(a,b,c,wall);else g.triangle(b,a,c,wall);
  }
  g.quad([-.77,1.24,.62],[.77,1.24,.62],[.77,1.90,0],[-.77,1.90,0],roof);
  g.quad([.77,1.24,-.62],[-.77,1.24,-.62],[-.77,1.90,0],[.77,1.90,0],roof);
  g.block(-.43,1.57,-.18,.19,.51,.21,CREAM);
  g.block(-.43,2.08,-.18,.24,.07,.26,RED);
  g.quad([-.12,.195,.522],[.11,.195,.522],[.11,.91,.522],[-.12,.91,.522],BLUE);
  for(const x of [-.43,.43]){
    g.quad([x-.14,.64,.523],[x+.14,.64,.523],[x+.14,1.02,.523],[x-.14,1.02,.523],INK);
    for(const side of [-1,1]){
      const shutter=x+side*.186;
      g.quad([shutter-.035,.62,.526],[shutter+.035,.62,.526],[shutter+.035,1.04,.526],[shutter-.035,1.04,.526], BLUE);
    }
    g.quad([x-.14,.82,.527],[x+.14,.82,.527],[x+.14,.845,.527],[x-.14,.845,.527],CREAM);
  }
  return g.finish();
}

/** A fishmonger's sunshade over a counter. Real struts meet the beam and the folded canvas. */
export function fishStall(): BufferGeometry {
  const g=new PaintedFaces();
  for(const x of [-.64,.64])for(const z of [-.35,.35]) g.block(x,-.025,z,.06,1.12,.06,WOOD);
  g.block(0,-.025,0,1.2,.51,.55,BLUE);
  g.block(0,.485,0,1.32,.07,.68,CREAM);
  for(let stripe=0;stripe<7;stripe++) {
    const a=-.77+stripe*.22,b=a+.22,paint=stripe%2 ? CREAM : RED;
    for(const s of [-1,1]){
      const p:Point=[a,1.09,s*.45],q:Point=[b,1.09,s*.45],r:Point=[b,1.34,0],v:Point=[a,1.34,0];
      if(s>0)g.quad(p,q,r,v,paint);else g.quad(v,r,q,p,paint);
    }
    g.quad([a,1.01,.45],[b,1.01,.45],[b,1.09,.45],[a,1.09,.45],paint);
  }
  return g.finish();
}

/** A stack of sawn sleepers ready for its track, with two smaller crosswise timbers on top. */
export function buildTimber(): BufferGeometry {
  const g=new PaintedFaces();
  for(const z of [-.28,.05,.38])g.block(0,-.045,z,1.34,.15,.23,WOOD);
  for(const x of [-.45,.42])g.block(x,.105,.05,.23,.12,.97,0xd2a46e);
  return g.finish();
}

/** A short oilskin coat and southwester pick out the people working at the fish stalls. */
export function harbourResident(yellow: boolean): BufferGeometry {
  const g = new PaintedFaces(), coat = yellow ? 0xe7a139 : 0x3f7e85, skin = 0xc98962;
  for (const x of [-.075,.075]) g.block(x,-.025,.035,.10,.34,.155,INK);
  g.block(0,.29,0,.31,.32,.20,coat);
  g.block(0,.61,0,.19,.16,.17,skin);
  g.block(0,.77,0,.25,.065,.23,BLUE);
  for(const side of [-1,1]) {
    g.block(side*.173,.34,.018,.056,.20,.09,coat);
    g.block(side*.173,.29,.063,.054,.07,.065,skin);
  }
  return g.finish();
}

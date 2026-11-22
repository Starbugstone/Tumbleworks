import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

type Point = readonly [number, number, number];

/** Small painted wooden models. Each face has its own paint and crease normal, then bakes into the village draw. */
export class PaintedFaces {
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

const STONE = 0x898479;
const CLAY = 0xb95c47;
const SLATE = 0x4b6676;

const townHouses = {
  'fisher-row': { width: 2.08, depth: 1.12, wall: 1.64, roof: .61, paint: 0xe7c193, tiles: CLAY, door: BLUE, bays: 3, hip: .0, chimney: -.65 },
  'pilot-house': { width: 1.45, depth: 1.31, wall: 2.14, roof: .56, paint: 0xece0bd, tiles: SLATE, door: RED, bays: 2, hip: .39, chimney: .4 },
  'salt-cottage': { width: 1.61, depth: 1.25, wall: 1.29, roof: .71, paint: 0xcd9674, tiles: SLATE, door: 0x476755, bays: 2, hip: .0, chimney: -.52 },
  'smokehouse': { width: 2.26, depth: 1.37, wall: 1.38, roof: .57, paint: 0xcbb590, tiles: 0x4e4d55, door: 0x725744, bays: 2, hip: .0, chimney: .72 },
  'chandlery': { width: 2.20, depth: 1.30, wall: 1.90, roof: .55, paint: 0xe6d2a8, tiles: 0x917454, door: 0x456c68, bays: 3, hip: .25, chimney: -.65 },
} as const;

export type HarbourHouse = keyof typeof townHouses;

function framedWindow(g: PaintedFaces, x: number, y: number, z: number, width: number, height: number, paint: number): void {
  const half = width / 2;
  const panel = (w: number, low: number, high: number, face: number, tint: number) =>
    g.quad([x-w,low,face],[x+w,low,face],[x+w,high,face],[x-w,high,face],tint);
  panel(half+.052,y-.02,y+height+.034,z,paint);
  panel(half,y,y+height,z+.006,INK);
  panel(half,y+height*.53,y+height*.53+.025,z+.014,CREAM);
  g.block(x,y-.035,z,width+.15,.045,.09,CREAM);
}

/** Harbour buildings share stone footings and front stoops, with individual massing and roofing. */
export function harbourTownHouse(kind: HarbourHouse): BufferGeometry {
  const { width, depth, wall, roof, paint, tiles, door, bays, hip, chimney } = townHouses[kind];
  const g = new PaintedFaces(), x = width/2, z = depth/2, eave = wall+.1, top = eave+roof;
  const over = .10, ridgeSpan = x + over - hip;
  g.block(0,-.20,0,width+.12,.36,depth+.12,STONE);
  g.block(0,.16,0,width,wall-.06,depth,paint);
  g.block(0,-.13,z+.12,.56,.26,.27,STONE);
  g.block(0,.13,z+.051,.43,kind==='smokehouse'?.83:.96,.12,door);
  g.block(.134,.59,z+.117,.035,.038,.019,0xf5cb74);

  if (hip === 0) {
    g.triangle([-x,eave,-z],[-x,eave,z],[-x,top,0],paint);
    g.triangle([x,eave,z],[x,eave,-z],[x,top,0],paint);
  }
  const pales = new Color(tiles).multiplyScalar(1.17).getHex();
  const darks = new Color(tiles).multiplyScalar(.82).getHex();
  for (let strip=0;strip<4;strip++) {
    const at = strip/4, next = (strip+1)/4;
    const a = x+over-hip*at, b = x+over-hip*next;
    const y = eave-.035+(roof+.035)*at, upper = eave-.035+(roof+.035)*next;
    const low = (z+over)*(1-at), high = (z+over)*(1-next);
    const tint = strip===0 ? darks : strip===2 ? pales : tiles;
    g.quad([-a,y,low],[a,y,low],[b,upper,high],[-b,upper,high],tint);
    g.quad([a,y,-low],[-a,y,-low],[-b,upper,-high],[b,upper,-high],tint);
  }
  if (hip > 0) {
    g.triangle([-x-over,eave-.035,-z-over],[-x-over,eave-.035,z+over],[-ridgeSpan,top,0],darks);
    g.triangle([x+over,eave-.035,z+over],[x+over,eave-.035,-z-over],[ridgeSpan,top,0],pales);
  }
  g.block(0,top-.028,0,2*ridgeSpan-.04,.066,.106,darks);
  g.block(chimney,top-.41,-.23,.22,.61,.23,kind==='smokehouse'?CLAY:paint);
  g.block(chimney,top+.20,-.23,.32,.08,.31,STONE);
  if (kind === 'smokehouse') {
    g.block(-chimney,top-.40,-.23,.25,.56,.24,CLAY);
    g.block(-chimney,top+.16,-.23,.34,.08,.32,STONE);
  }

  for (const side of [-1,1]) {
    const windowX=side*width*.32;
    framedWindow(g,windowX,.54,z+.004,kind==='chandlery'?.44:.27,.33,door);
    if (wall > 1.55) framedWindow(g,windowX,wall-.48,z+.004,.25,.32,door);
  }
  if (bays===3) framedWindow(g,0,wall-.48,z+.004,.27,.32,door);
  if (kind==='chandlery') {
    g.block(0,1.03,z+.09,width*.81,.09,.20,door);
    for (const side of [-1,1]) g.block(side*width*.39,.86,z+.12,.08,.19,.12,WOOD);
    g.block(0,.17,-z-.023,1.27,.88,.075,door);
    g.block(0,.19,-z-.071,.035,.83,.035,WOOD);
    g.block(0,1.022,-z-.038,1.40,.09,.157,WOOD);
    g.block(.64,1.37,-z-.031,.36,.35,.087,INK);
    g.block(-.64,1.37,-z-.031,.36,.35,.087,INK);
    g.block(0,1.27,z+.044,.44,.21,.061,BLUE);
    g.quad([-.12,1.32,z+.077],[.12,1.32,z+.077],[.08,1.41,z+.077],[-.08,1.41,z+.077],CREAM);
  }
  return g.finish();
}

export type HarbourYardPiece = 'net-rack' | 'lobster-pots' | 'fish-trays' | 'drying-line' | 'coastal-thicket' | 'stone-wall';

export function harbourScenery(name: string): BufferGeometry | undefined {
  if (Object.hasOwn(townHouses, name)) return harbourTownHouse(name as HarbourHouse);
  switch (name) {
    case 'net-rack': case 'lobster-pots': case 'fish-trays': case 'drying-line': case 'coastal-thicket': case 'stone-wall':
      return harbourYardPiece(name);
    case 'sail-loft': return sailLoft();
    case 'harbour-dinghy': return harbourDinghy();
    case 'fish-stall': return fishStall();
    case 'crew-blue': return harbourResident(false);
    case 'crew-gold': return harbourResident(true);
  }
}

export function harbourYardPiece(kind: HarbourYardPiece): BufferGeometry {
  const g = new PaintedFaces();
  switch (kind) {
    case 'net-rack': {
      for (const x of [-.89,.89]) g.block(x,-.12,0,.10,1.46,.13,WOOD);
      g.block(0,1.23,0,1.94,.095,.095,WOOD);
      g.block(0,.36,0,1.78,.065,.08,WOOD);
      // A dark open weave lets the ground and adjacent track read through the drying net.
      const a=-.76, b=.76, bottom=.38, top=1.23, offset=.047;
      for (let i=0;i<9;i++) {
        const x=a+(b-a)*i/8, c=Math.min(x+.20,b+.10), d=Math.min(x+.224,b+.125);
        g.quad([x,bottom,offset],[x+.024,bottom,offset],[d,top,offset],[c,top,offset],0x68513d);
      }
      for (let i=1;i<6;i++) {
        const t=i/6, y=bottom+(top-bottom)*t, x=.20*t;
        g.quad([a+x,y,offset+.005],[b+x,y,offset+.005],[b+x,y+.020,offset+.005],[a+x,y+.020,offset+.005],0x8c7854);
      }
      for (const x of [-.52,0,.52]) g.block(x,1.166,.075,.095,.071,.075,RED);
      break;
    }
    case 'lobster-pots': {
      for (const [x,z,raised] of [[-.36,-.24,0],[.37,.19,0],[.38,.21,.30]]) {
        g.block(x!,-.08+raised!,z!,.66,.17,.48,0x624e38);
        const l=x!-.30,r=x!+.30,b=z!-.23,f=z!+.23,y=.09+raised!,high=y+.22;
        g.quad([l,y,f],[r,y,f],[r,high,z!],[l,high,z!],0x796751);
        g.quad([r,y,b],[l,y,b],[l,high,z!],[r,high,z!],0x8a7653);
        for (const bar of [-.19,0,.19]) g.block(x!+bar,high-.025,z!,.029,.040,.102,0xcfa872);
        g.block(x!-.19,y+.041,f-.012,.12,.105,.037,INK);
      }
      break;
    }
    case 'fish-trays': {
      for (const [x,z,width,high,paint] of [[-.46,-.15,.57,.28,0x55756d],[.31,.21,.66,.22,0x96734c],[.45,-.34,.49,.27,0xa7583c]]) {
        g.block(x!,-.085,z!,width!,high!+.085,.45,paint!);
        for (const side of [-1,1]) g.block(x!+side*width!*.43,.035,z!+.242,.062,high!-.023,.042,WOOD);
        for (const xOffset of [-.12,.03,.17]) g.block(x!+xOffset,high!-.013,z!,.055,.06,.26,0x8bb1a7);
      }
      break;
    }
    case 'drying-line': {
      for (const x of [-.91,.91]) g.block(x,-.14,0,.075,1.22,.075,WOOD);
      for (const [left,right,low,paint] of [[-.78,-.40,.70,CREAM],[-.26,.12,.59,BLUE],[.31,.70,.73,CLAY]]) {
        g.quad([left!,low!,0],[right!,low!+.022,0],[right!,1.03,0],[left!,1.03,0],paint!);
      }
      g.block(0,1.033,0,1.85,.023,.023,0x79674e);
      break;
    }
    case 'coastal-thicket': {
      for (const [x,z,r,h,paint] of [[-.49,.19,.44,.80,0x416451],[.38,.25,.44,1.07,0x516e46],[.12,-.44,.60,1.38,0x355d4b]]) {
        g.block(x!,-.14,z!,.103,h!*.62,.103,0x6d5b3c);
        const crown: Point=[x!+r!*.16,h!,z!-.08];
        for (let i=0;i<6;i++) {
          const point=(n:number,y:number,amount:number): Point=>[x!+Math.cos(n*Math.PI/3)*r!*amount,y,z!+Math.sin(n*Math.PI/3)*r!*amount];
          const a=point(i,h!*.64,1), b=point(i+1,h!*.64,1);
          const c=point(i,h!*.90,.59), d=point(i+1,h!*.90,.59);
          const shade=new Color(paint!).multiplyScalar(i%3===0?1.22:.94).getHex();
          g.triangle(crown,d,c,shade);
          g.quad(c,d,b,a,shade);
          g.quad(a,b,point(i+1,h!*.42,.69),point(i,h!*.42,.69),paint!);
        }
      }
      break;
    }
    case 'stone-wall': {
      g.block(0,-.25,0,2.24,.60,.27,STONE);
      for (let i=0;i<5;i++) g.block(-.89+i*.445,.35,0,.42,.082,.35,i%2===0?0xaaa692:0x979686);
      break;
    }
  }
  return g.finish();
}

/** A shallow clinker dinghy waiting at a floating mooring, with thwarts visible above water. */
function harbourDinghy(): BufferGeometry {
  const g = new PaintedFaces();
  const frames = [[-.93,.03,.31],[-.61,.27,.23],[-.09,.36,.20],[.51,.34,.20],[.75,.29,.24]] as const;
  for (const side of [-1,1]) for (let i = 1; i < frames.length; i++) {
    const [x,w,y] = frames[i-1]!, [nextX,nextW,nextY] = frames[i]!;
    const a: Point=[x,-.13,side*w*.59], b: Point=[nextX,-.13,side*nextW*.59];
    const c: Point=[nextX,nextY,side*nextW], d: Point=[x,y,side*w];
    const e: Point=[nextX,nextY-.043,side*(nextW-.036)], f: Point=[x,y-.043,side*(w-.018)];
    const inner: Point=[x,.085,side*w*.55], nextInner: Point=[nextX,.085,side*nextW*.55];
    if (side > 0) {
      g.quad(a,b,c,d,RED);
      g.quad(d,c,e,f,CREAM);
      g.quad(f,e,nextInner,inner,WOOD);
    } else {
      g.quad(d,c,b,a,RED);
      g.quad(f,e,c,d,CREAM);
      g.quad(inner,nextInner,e,f,WOOD);
    }
  }
  g.quad([.75,-.13,.17],[.75,-.13,-.17],[.75,.24,-.29],[.75,.24,.29],BLUE);
  g.block(-.03,.081,0,1.21,.055,.35,WOOD);
  for (const x of [-.35,.16,.52]) g.block(x,.158,0,.12,.036,.54,CREAM);
  g.block(-.61,.167,.03,.34,.041,.105,BLUE);
  g.quad([-1.37,.079,-.023],[-.92,.229,-.023],[-.92,.229,.023],[-1.37,.079,.023],WOOD);
  g.block(-1.41,.02,0,.16,.13,.15,0xd5a85e);
  return g.finish();
}

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

/** The sailmaker's loft has a tide-blue gable, a loading hatch and a projecting hoist over the double doors. */
export function sailLoft(): BufferGeometry {
  const g=new PaintedFaces();
  g.block(0,-.035,0,2.87,.22,1.69,0x857762);
  g.block(0,.185,0,2.68,1.38,1.53,CREAM);
  const eave=1.565, ridge=2.22;
  for(const side of [-1,1]){
    const z=side*.765;
    const a:Point=[-1.34,eave,z], b:Point=[1.34,eave,z], c:Point=[0,ridge,z];
    if(side>0)g.triangle(a,b,c,BLUE);else g.triangle(b,a,c,BLUE);
    const x=side*1.52;
    const p:Point=[0,ridge+.025,-.91],q:Point=[0,ridge+.025,.91],r:Point=[x,eave-.04,.91],t:Point=[x,eave-.04,-.91];
    if(side>0)g.quad(p,q,r,t,0x607481);else g.quad(q,p,t,r,0x526675);
  }
  for(const side of [-1,1]){
    const x=side*.30;
    g.block(x,.185,.78,.57,.94,.044,BLUE);
    g.block(side*.98,.58,.78,.39,.44,.045,INK);
    g.block(side*.98,.78,.82,.41,.035,.045,CREAM);
    g.block(side*.98,.56,.82,.035,.22,.045,CREAM);
    g.block(side*.98,.815,.82,.035,.215,.045,CREAM);
  }
  g.block(0,1.44,.79,.45,.49,.045,INK);
  g.block(0,1.94,.83,.11,.10,.67,WOOD);
  g.block(0,1.34,1.135,.03,.60,.03,INK);
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
export function buildTimber(chapter = 0): BufferGeometry {
  const g=new PaintedFaces();
  if (chapter === 3 || chapter === 5) {
    const masonry = chapter === 3 ? [0x979182,0xbbb09c] : [0x925842,0xb66d4d];
    for(const x of [-.34,.34])for(const z of [-.23,.23])g.block(x,-.09,z,.63,.22,.41,masonry[0]!);
    g.block(-.16,.13,-.13,.64,.19,.40,masonry[1]!);
    return g.finish();
  }
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

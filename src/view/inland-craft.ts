import { Uint8BufferAttribute, Vector3 } from 'three';
import { PaintedFaces } from './harbour-craft';
import { ARTISAN_SURFACE } from './village-artisan';

const stone = 0x766d60, plaster = 0xe5d3aa, oak = 0x835636, window = 0x34545a;
const slate = 0x454c61, brick = 0x9d5139, cream = 0xe6dfbd;
type Section = readonly [radius: number, height: number, paint: number];

class WorkshopFaces extends PaintedFaces {
  movingArm = Infinity;
  private readonly curved: {start:number; end:number; x:number; y:number; z:number; rx:number; ry:number; rz:number}[]=[];
  /** Shape the coarse silhouette and shade each crown as continuous foliage. */
  crown(x:number,y:number,z:number,rx:number,ry:number,rz:number,paint:number) {
    const start=this.vertices.length/3;
    const point=(i:number,j:number): readonly [number,number,number] => {
      const lat=Math.PI*j/4, lon=Math.PI*i/4+.21;
      const radius=Math.sin(lat)*(1+.075*Math.cos(lon*3+lat));
      return [x+rx*radius*Math.cos(lon),y+ry*Math.cos(lat),z+rz*radius*Math.sin(lon)];
    };
    for(let i=0;i<8;i++)for(let j=0;j<4;j++) {
      const a=point(i,j),b=point(i+1,j),c=point(i+1,j+1),d=point(i,j+1);
      if(j>0)this.triangle(a,b,d,paint);
      if(j<3)this.triangle(b,c,d,paint);
    }
    this.curved.push({start,end:this.vertices.length/3,x,y,z,rx,ry,rz});
  }
  override finish() {
    const g=super.finish(), positions=g.getAttribute('position'), normals=g.getAttribute('normal');
    const normal=new Vector3();
    for(const c of this.curved)for(let i=c.start;i<c.end;i++){
      normal.set((positions.getX(i)-c.x)/(c.rx*c.rx),(positions.getY(i)-c.y)/(c.ry*c.ry),
        (positions.getZ(i)-c.z)/(c.rz*c.rz)).normalize();
      normals.setXYZ(i,normal.x,normal.y,normal.z);
    }
    if(Number.isFinite(this.movingArm)) {
      const parts = new Uint8Array(positions.count);
      parts.fill(ARTISAN_SURFACE,this.movingArm);
      g.setAttribute('terrainSurface',new Uint8BufferAttribute(parts,1));
    }
    return g;
  }
  /** A closed, gabled roof with a visible overhang and painted bargeboards. */
  roof(x: number, z: number, width: number, depth: number, eave: number, rise: number, paint: number, trim: number) {
    const l=x-width/2, r=x+width/2, b=z-depth/2, f=z+depth/2, y=eave+.07, top=y+rise;
    for (const front of [false,true]) {
      const v=front?f:b;
      if (front) this.triangle([l,y,v],[r,y,v],[x,top,v],trim);
      else this.triangle([r,y,v],[l,y,v],[x,top,v],trim);
    }
    this.quad([l,y,b],[l,y,f],[x,top,f],[x,top,b],paint);
    this.quad([r,y,f],[r,y,b],[x,top,b],[x,top,f],paint);
    for (const side of [-1,1]) for (const fraction of [.30,.60,.89]) {
      const gutter=x+side*width*.5*fraction, h=top-rise*fraction+.009;
      const e: readonly [number,number,number]=[gutter,h,b];
      const f1: readonly [number,number,number]=[gutter,h,f];
      const f2: readonly [number,number,number]=[gutter+side*.027,h-.005,f];
      const e2: readonly [number,number,number]=[gutter+side*.027,h-.005,b];
      if(side>0)this.quad(e,f1,f2,e2,trim); else this.quad(e2,f2,f1,e,trim);
    }
    this.block(0,top-.008,z,.095,.055,depth+.035,trim);
    this.block(l+.035,eave,z,.07,.07,depth,trim);
    this.block(r-.035,eave,z,.07,.07,depth,trim);
  }
  /** Turn a tapered working vessel or chimney with one continuous outer skin. */
  turn(x:number,z:number,rings:readonly Section[],segments=12) {
    for(let j=1;j<rings.length;j++) {
      const [lo,y0]=rings[j-1]!, [hi,y1,paint]=rings[j]!;
      for(let k=0;k<segments;k++){
        const a=2*Math.PI*k/segments,b=2*Math.PI*(k+1)/segments;
        this.quad([x+lo*Math.cos(b),y0,z+lo*Math.sin(b)],[x+lo*Math.cos(a),y0,z+lo*Math.sin(a)],
          [x+hi*Math.cos(a),y1,z+hi*Math.sin(a)],[x+hi*Math.cos(b),y1,z+hi*Math.sin(b)],paint);
      }
    }
  }
  casement(x:number,y:number,z:number,w:number,h:number) {
    this.block(x,y,z,w,h,.035,window);
    // Seat the crossbar in the pane with its end faces inside the glazing edges.
    this.block(x,y+h*.49,z+.025,w-.018,.038,.025,cream);
    this.block(x,y,z+.046,.035,h,.023,cream);
    this.block(x,y-.055,z+.033,w+.09,.055,.10,oak);
  }
}

function pottingHouse(g:WorkshopFaces) {
  g.block(0,-.21,0,2.7,.55,1.46,brick);
  g.block(0,.34,0,2.63,.72,1.40,0x67918b);
  // An asymmetric span of pale glass, with narrow raised glazing bars.
  const l=-1.43,r=1.43,front=.80,back=-.80,crest=-.18,y=1.06,top=1.71;
  for(let i=0;i<6;i++) {
    const a=l+(r-l)*i/6,b=l+(r-l)*(i+1)/6;
    g.quad([a,y,front],[b,y,front],[b,top,crest],[a,top,crest],i%3===1?0x98c9bb:0xb4d9ce);
    g.quad([b,y,back],[a,y,back],[a,top,crest],[b,top,crest],0x73a79e);
    g.block(b-.04,.34,.714,.045,.72,.038,cream);
    if(i<5)g.quad([b-.024,y+.009,front],[b+.024,y+.009,front],[b+.024,top+.009,crest],[b-.024,top+.009,crest],cream);
  }
  g.triangle([r,y,front],[r,y,back],[r,top,crest],0xb5d6c3);
  g.triangle([l,y,back],[l,y,front],[l,top,crest],0x78a69d);
  g.block(0,top,crest,2.90,.065,.065,cream);
  g.block(0,.70,.745,2.63,.05,.033,cream);
  g.block(-.64,.27,.77,.42,.72,.06,0x3a665b);
}

/** A glazed palm house with a barrel vault, clear ridge and iron glazing bars. */
function palmHouse(g: WorkshopFaces) {
  const length=3.5, radius=.99, sill=.76, panes=8;
  g.block(0,-.22,0,length,.50,1.85,0x9b775e);
  g.block(0,.28,0,length-.07,.48,1.82,0x638f86);
  const point=(x:number,angle:number,lift:number): readonly [number,number,number] =>
    [x,sill+(radius+lift)*Math.sin(angle),(radius+lift)*Math.cos(angle)];
  for(let j=0;j<panes;j++) {
    const a=Math.PI*j/panes,b=Math.PI*(j+1)/panes;
    for(let i=0;i<6;i++){
      const x=length*(i/6-.5), end=x+length/6;
      const pane=[0x82b4aa,0xa7cfc2,0x98c5b8][(i+j)%3]!;
      g.quad(point(x,a,0),point(end,a,0),point(end,b,0),point(x,b,0),pane);
      g.quad(point(x,a,.02),point(x+.035,a,.02),point(x+.035,b,.02),point(x,b,.02),cream);
    }
    for(const side of [-1,1]){
      const x=side*length*.5,c:readonly [number,number,number]=[x,sill,0];
      if(side<0)g.triangle(point(x,b,0),point(x,a,0),c,0x638b82);
      else g.triangle(point(x,a,0),point(x,b,0),c,0x638b82);
    }
  }
  g.block(0,sill+radius,-.015,length+.09,.06,.075,cream);
  g.block(0,.28,.93,.50,.78,.065,0x315e57);
}

function civicClock(g: WorkshopFaces) {
  const wall=0xd3b896, trim=0x7c6556;
  g.block(0,-.25,0,1.52,.54,1.38,stone);
  g.block(0,.29,0,1.33,1.76,1.22,wall);
  for(const x of [-.57,.57])g.block(x,.29,.622,.095,1.76,.06,trim);
  g.block(0,.29,.626,.42,.81,.046,0x425358);
  g.block(0,2.05,0,1.48,.13,1.36,trim);
  g.block(0,2.18,0,1.32,1.06,1.20,0x58717a);
  // Face and hands are part of the single civic tower, facing the village street.
  const y=2.74, z=.608;
  for(let h=0;h<16;h++) {
    const a=h*Math.PI/8,b=(h+1)*Math.PI/8;
    const dial=(r:number,t:number,d:number):readonly [number,number,number]=>[r*Math.cos(t),y+r*Math.sin(t),d];
    g.quad(dial(.47,a,z),dial(.47,b,z),dial(.403,b,z),dial(.403,a,z),trim);
    g.triangle([0,y,z+.004],dial(.403,a,z+.004),dial(.403,b,z+.004),0xece1ba);
  }
  g.triangle([-.04,y-.045,z+.012],[.05,y+.025,z+.012],[-.16,y+.26,z+.012],window);
  g.triangle([-.038,y+.038,z+.014],[.015,y-.045,z+.014],[.29,y+.08,z+.014],window);
  g.block(0,3.24,0,1.54,.09,1.44,trim);
  g.turn(0,0,[[1.01,3.33,0],[.56,3.70,slate],[.32,4.10,0x516277],[.25,4.20,cream],
    [.24,4.53,0x4c6b6c],[.34,4.56,slate],[.26,4.75,slate],[.045,5.10,0x4c676b],[0,5.28,trim]],8);
}

function granary(g:WorkshopFaces) {
  g.block(0,-.20,0,2.52,.52,1.6,stone);
  g.block(0,.32,0,2.42,1.08,1.53,0xc89453);
  g.roof(0,0,2.7,1.79,1.40,.60,0x9d573a,oak);
  g.block(0,.32,.78,.71,.90,.05,oak);
  for(const x of [-.94,.92]) g.casement(x,.78,.78,.31,.41);
  for(const x of [-1.15,-.53,.54,1.15])g.block(x,.32,.79,.075,1.05,.07,oak);
  g.block(0,1.25,.84,2.40,.10,.06,oak);
  g.block(0,1.52,.905,.36,.30,.035,window);
}

function atelier(g:WorkshopFaces) {
  g.block(0,-.26,0,1.43,.47,1.48,stone);
  g.block(0,.21,0,1.36,1.30,1.40,plaster);
  g.roof(0,0,1.65,1.62,1.51,.89,slate,0x636876);
  g.block(.45,1.78,-.43,.23,.57,.24,brick);
  g.block(.45,2.35,-.43,.30,.08,.31,stone);
  g.block(-.37,.21,.72,.33,.77,.045,oak);
  g.casement(.28,.66,.72,.59,.54);
  g.casement(0,1.58,.822,.29,.32);
}

/** Short stone street frontages with separate rooflines and their doors facing the court. */
function courtHouse(form: 'brick' | 'plaster' | 'stone', g: WorkshopFaces) {
  const looks = {
    brick: [1.66, 1.22, 1.20, .42, .38, 0xb2684f, 0x615057],
    plaster: [1.42, 1.20, 1.31, .68, 0, 0xe4cfae, 0x414957],
    stone: [1.80, 1.27, .92, .45, .28, 0xb5ab91, 0x896e49],
  } as const;
  const [width, depth, wall, rise, hip, facade, shingles] = looks[form];
  const x = width / 2, z = depth / 2, eave = wall + .14;
  const end = x + .11, side = z + .10, ridge = end - hip, top = eave + rise;
  g.block(0,-.22,0,width+.094,.36,depth+.10,stone);
  g.block(0,.14,0,width,wall,depth,facade);
  g.quad([-end,eave,side],[end,eave,side],[ridge,top,0],[-ridge,top,0],shingles);
  g.quad([end,eave,-side],[-end,eave,-side],[-ridge,top,0],[ridge,top,0],form==='plaster'?0x485461:shingles);
  if (hip > 0) {
    g.triangle([-end,eave,-side],[-end,eave,side],[-ridge,top,0],shingles);
    g.triangle([end,eave,side],[end,eave,-side],[ridge,top,0],shingles);
  } else {
    g.triangle([-x,eave,-z],[-x,eave,z],[-x,top-.05,0],facade);
    g.triangle([x,eave,z],[x,eave,-z],[x,top-.05,0],facade);
  }
  g.block(0,top-.018,0,2*ridge-.06,.055,.072,shingles);
  const panel = (at: number, y: number, w: number, h: number, colour: number, front = z + .006) =>
    g.quad([at-w/2,y,front],[at+w/2,y,front],[at+w/2,y+h,front],[at-w/2,y+h,front],colour);
  panel(-.30,.14,.27,.53,oak);
  panel(.28,.56,.39,.30,cream);
  panel(.28,.59,.31,.24,window,z+.012);
  panel(.28,.69,.31,.026,cream,z+.017);
  if (wall > 1) panel(-.30,.86,.24,.25,window);
  if (form === 'brick') {
    g.block(.40,top-.33,-.20,.16,.51,.16,brick);
    g.block(.40,top+.18,-.20,.21,.06,.21,stone);
  }
}

/** A covered loading table and crates occupy the working edge of a glass terrace. */
function sortingYard(g: WorkshopFaces) {
  const a = -1.42, b = 1.42, c = -.80, d = .79;
  const upper = 1.4, lower = 1.07, thickness = .045;
  for (const x of [-1.27,1.27]) for (const z of [-.65,.65]) {
    const seat = lower + (upper - lower) * (d - z) / (d - c) - .025;
    g.block(x,-.16,z,.12,seat+.16,.12,oak);
  }
  g.quad([a,lower,d],[b,lower,d],[b,upper,c],[a,upper,c],0x4f6266);
  g.quad([a,upper-thickness,c],[b,upper-thickness,c],[b,lower-thickness,d],[a,lower-thickness,d],0x394d51);
  g.quad([a,lower-thickness,d],[b,lower-thickness,d],[b,lower,d],[a,lower,d],0x566463);
  g.quad([b,upper-thickness,c],[a,upper-thickness,c],[a,upper,c],[b,upper,c],0x566463);
  g.quad([a,upper-thickness,c],[a,lower-thickness,d],[a,lower,d],[a,upper,c],0x566463);
  g.quad([b,lower-thickness,d],[b,upper-thickness,c],[b,upper,c],[b,lower,d],0x566463);
  g.block(0,1.052,d,2.74,.075,.065,0x9a6f46);
  g.block(0,.42,0,1.82,.12,.69,oak);
  for (const x of [-.71,.71]) g.block(x,-.13,0,.14,.56,.58,oak);
  for (const [x,z,h,paint] of [[-.56,-.07,.18,0x6b8989],[.23,.13,.29,0xa06b46],[.78,-.10,.16,0x527677]] as const) {
    g.block(x,.54,z,.43,h,.34,paint);
    g.quad([x-.14,.55,z+.175],[x-.10,.55,z+.175],[x-.10,.54+h,z+.175],[x-.14,.54+h,z+.175],cream);
  }
  g.block(-.85,-.12,.42,.44,.39,.36,0x9c754f);
  g.block(.95,-.12,.34,.42,.29,.37,0x75938c);
}

/** A low stone planting bed, with the foliage gathering over its inward-facing edges. */
function civicPlanter(g: WorkshopFaces) {
  g.block(0,-.30,0,1.52,.48,.76,0x9c927e);
  g.block(0,.18,0,1.37,.06,.63,0x4c5945);
  for (const [x,z,height,paint] of [[-.44,.025,.53,0x4d6650],[.06,-.04,.65,0x53684b],[.46,.015,.42,0x566d51]] as const) {
    g.turn(x,z,[[.14,.23,0],[.20,.36,paint],[.105,height,paint],[0,height+.06,paint]],5);
  }
}

function bothy(g:WorkshopFaces) {
  g.block(0,-.22,0,2.0,.51,1.49,stone);
  g.block(0,.29,0,1.90,.70,1.39,0xb7ab8a);
  g.roof(0,0,2.28,1.70,.99,.55,0x927659,0x655443);
  g.block(-.72,1.09,-.40,.28,.63,.31,stone);
  g.block(-.32,.29,.71,.42,.68,.045,oak);
  g.casement(.49,.56,.71,.44,.33);
}

function lehr(g:WorkshopFaces) {
  g.block(0,-.23,0,2.64,1.29,1.43,brick);
  g.roof(0,0,2.80,1.63,1.06,.37,0x54565b,0x6e6156);
  for(const x of [-.88,0,.88]){
    g.block(x,.21,.729,.65,.65,.036,0x473b37);
    g.block(x,.77,.762,.71,.09,.039,0xc38c69);
    g.block(x,.29,.764,.51,.08,.035,0x9b6043);
  }
}

function furnace(g:WorkshopFaces) {
  g.turn(0,0,[[.67,-.23,stone],[.78,.17,stone],[.78,.70,brick],[.68,.98,0xae664a],
    [.37,1.48,brick],[.32,1.74,0x73473e],[.23,2.69,0x584843],[.28,2.70,stone],
    [.28,2.84,0x473e39],[.18,2.84,stone],[.18,2.67,0x282d30]]);
  g.block(0,.17,.74,.64,.48,.10,0x56453b);
  g.block(0,.17,.806,.42,.33,.042,0x352c2b);
  g.block(0,.20,.834,.32,.08,.028,0xbf6c43);
}

function flowerBed(g:WorkshopFaces) {
  g.block(0,-.16,0,2.86,.30,1.64,0x815944);
  for(const z of [-.48,0,.48]){
    g.block(0,.14,z,2.64,.10,.28,0x4c6447);
    for(let i=0;i<7;i++){
      const x=(i-3)*.36;
      // Two folded leaves and a cupped flower stay legible across the whole terrace.
      g.triangle([x-.16,.24,z+.04],[x,.36,z],[x,.24,z-.07],0x69864b);
      const colour=z===0?0xce8273:0xeaca9a;
      g.triangle([x-.10,.36,z+.08],[x+.10,.36,z+.08],[x,.31,z-.08],colour);
      g.triangle([x+.10,.36,z+.08],[x+.04,.41,z-.06],[x,.31,z-.08],colour);
    }
  }
}

function woodYard(g:WorkshopFaces) {
  for (let row=0;row<3;row++)for(let i=0;i<4-row;i++){
    g.block(-.22,-.05+row*.19,(i-(3-row)*.5)*.23,1.75,.185,.215,i%2?0xc08c53:0xab7746);
  }
  for(const z of [-.59,.58])g.block(.91,-.18,z,.075,.70,.075,oak);
  g.block(.91,.35,0,.08,.095,1.32,oak);
}

function sheepfold(g:WorkshopFaces) {
  for(const x of [-1.15,0,1.15])g.block(x,-.16,-.61,.09,.70,.10,oak);
  for(const h of [.12,.37])g.block(0,h,-.61,2.38,.07,.07,0xa88c66);
  for(const side of [-1,1]){
    g.block(side*1.15,-.16,.64,.09,.70,.10,oak);
    for(const h of [.12,.37])g.block(side*1.15,h,.02,.07,.07,1.20,0x997f5c);
  }
  for(const x of [-.73,.73])g.block(x,.29,.64,.77,.075,.07,oak);
  for(const [x,z] of [[-.66,.29],[.55,-.15]] as const){
    for(const d of [-.13,.13])g.block(x+d,-.13,z,.075,.32,.10,0x574e42);
    g.turn(x,z,[[.18,.16,0],[.29,.25,cream],[.24,.43,0xe7dfc9],[0,.50,cream]],8);
    g.block(x+.23,.30,z+.08,.17,.16,.15,0x685e50);
  }
}

function pollard(g:WorkshopFaces) {
  g.turn(0,0,[[.20,-.19,oak],[.15,.55,0x635242],[.10,1.65,0x705a46]],7);
  for(const [x,y,z,rx,ry,rz,paint] of [
    [-.48,1.57,.10,.55,.95,.58,0x779255],[.41,1.66,.16,.56,.88,.55,0x81994f],
    [.10,1.91,-.24,.65,.93,.61,0x688944],[.12,2.38,-.12,.51,.54,.50,0x8aa364],
  ] as const)g.crown(x,y,z,rx,ry,rz,paint);
}

function court(g:WorkshopFaces) {
  for (const x of [-.93,.93]){
    g.turn(x,0,[[.30,-.20,stone],[.26,.14,stone],[.32,.38,0xa08066],[.32,.44,stone]],8);
    g.block(x,.44,0,.09,.48,.09,oak);
    g.crown(x,1.05,0,.42,.58,.39,0x547651);
  }
  g.block(0,.26,.05,1.08,.07,.31,oak);
  for(const x of [-.42,.42])g.block(x,-.18,.05,.11,.44,.23,stone);
}

function packhouse(g:WorkshopFaces) {
  g.block(0,-.25,0,2.82,.52,1.75,stone);
  g.block(0,.27,0,2.70,1.0,1.66,0xb66c50);
  g.roof(0,0,3.04,1.92,1.27,.39,0x55676b,0x70635b);
  for(const x of [-.89,0,.89])g.casement(x,.53,.845,.61,.54);
  g.block(0,1.33,.977,.40,.17,.04,window);
}

function scree(g:WorkshopFaces) {
  for(const [x,z,size] of [[-.75,-.1,.67],[.22,.25,.83],[.85,-.27,.44],[-.30,.53,.30]] as const){
    g.crown(x,.01,z,size,.48*size,.65*size,0x8e9384);
  }
  g.block(-.55,-.13,-.28,.12,1.20,.12,0x6b6350);
  g.crown(-.76,1.11,-.25,.65,.37,.39,0x5a705a);
  g.crown(-.35,1.35,-.28,.48,.42,.37,0x728365);
}

/** One work gesture per island, driven by the existing village frame. The feet remain planted. */
function artisan(job:number,g:WorkshopFaces) {
  const coat=[0x6f8861,0xd3b57d,0x6b8491,0x947558,0x637f83][job]!;
  for(const x of [-.085,.085])g.block(x,-.04,0,.12,.35,.17,0x3f4645);
  g.block(0,.31,0,.32,.34,.21,coat);
  g.block(0,.65,.02,.20,.17,.17,0xb98059);
  g.turn(0,.02,[[.16,.82,0],[.16,.85,oak],[.11,.86,oak],[.09,.94,coat],[0,.96,coat]],8);
  g.block(-.187,.36,.016,.08,.24,.11,coat);
  g.movingArm=g.vertices.length/3;
  g.block(.178,.51,.11,.085,.085,.25,coat);
  g.block(.178,.49,.25,.08,.08,.10,0xbc8661);
  if(job===0){
    g.turn(.177,.34,[[.11,.34,0],[.14,.39,0x4c7367],[.10,.53,0x688e80],[0,.54,stone]],8);
    g.block(.18,.43,.49,.065,.062,.18,0x678e7c);
  } else if(job===1){
    g.crown(.16,.47,.38,.18,.26,.15,0xcab084);
  } else if(job===3) {
    g.block(.186,.03,.24,.045,.85,.045,oak);
  } else {
    g.block(.18,.50,.42,.04,.044,.32,oak);
    g.block(.18,.49,.59,.11,.08,.07,job===4?0x97b5a8:stone);
  }
}

function glassRack(g:WorkshopFaces) {
  for(const x of [-.59,.59])g.block(x,-.16,0,.14,.28,1.15,oak);
  for(let row=0;row<4;row++) {
    const z=-.40+row*.22;
    g.block(0,.12,z,1.65,.71,.056, row%2===0?0x5f9c96:0x80b8b0);
    g.block(0,.83,z,1.67,.04,.060,0xc3d8c7);
  }
}
export const inlandCraft = {
  gardener:artisan.bind(null,0), miller:artisan.bind(null,1), horologist:artisan.bind(null,2),
  shepherd:artisan.bind(null,3), glassworker:artisan.bind(null,4), 'glass-rack':glassRack,
  'pollard':pollard, 'clock-court':court, 'fell-scrub':scree, 'glass-packing-house':packhouse,
  'palm-house':palmHouse, 'civic-clock':civicClock, 'potting-house':pottingHouse, 'planting-bed':flowerBed, 'grain-barn':granary, 'timber-yard':woodYard,
  'dial-atelier':atelier, 'brick-watchshop':courtHouse.bind(null,'brick'), 'plaster-terrace':courtHouse.bind(null,'plaster'),
  'stone-croft':courtHouse.bind(null,'stone'), 'fell-cottage':bothy, sheepfold, 'bottle-kiln':furnace, 'annealing-shed':lehr,
  'glass-sorting-yard':sortingYard, 'civic-planter':civicPlanter,
};

export function inlandGeometry(name:keyof typeof inlandCraft) {
  const faces=new WorkshopFaces();
  inlandCraft[name](faces);
  return faces.finish();
}

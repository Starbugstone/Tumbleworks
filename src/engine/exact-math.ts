/**
 * Trigonometry that gives the same bits on every device, for code a replay depends on. Math.sin and
 * friends may differ in the last bit between JavaScript engines (Chromium 156's Math.cos(2.3) isn't
 * Node 24's), and physics grows that bit into a different game. Addition, multiplication, division and
 * Math.sqrt are exact in every engine, so these use only those. Coefficients are fdlibm's. Drawing code
 * doesn't need this and can keep Math.
 */
const PIO2_HI = 1.5707963267341256;
const PIO2_LO = 6.077100506506192e-11;
const INV_PIO2 = 6.366197723675814e-1;

function kernelSin(x: number): number {
  const z = x * x;
  const r = 8.33333333332248946124e-3 + z * (-1.98412698298579493134e-4 + z * (2.75573137070700676789e-6 + z * (-2.50507602534068634195e-8 + z * 1.58969099521155010221e-10)));
  return x + z * x * (-1.66666666666666324348e-1 + z * r);
}

function kernelCos(x: number): number {
  const z = x * x;
  const r = z * (4.16666666666666019037e-2 + z * (-1.38888888888741095749e-3 + z * (2.48015872894767294178e-5 + z * (-2.75573143513906633035e-7 + z * (2.08757232129817482790e-9 + z * -1.13596475577881948265e-11)))));
  const half = 0.5 * z;
  const w = 1 - half;
  return w + (1 - w - half + z * r);
}

/** Which quarter turn x falls in, and how far past it. */
function reduce(x: number): { quadrant: number; rest: number } {
  const turns = Math.round(x * INV_PIO2);
  return { quadrant: ((turns % 4) + 4) % 4, rest: x - turns * PIO2_HI - turns * PIO2_LO };
}

export function sin(x: number): number {
  const { quadrant, rest } = reduce(x);
  switch (quadrant) {
    case 0: return kernelSin(rest);
    case 1: return kernelCos(rest);
    case 2: return -kernelSin(rest);
    default: return -kernelCos(rest);
  }
}

export function cos(x: number): number {
  const { quadrant, rest } = reduce(x);
  switch (quadrant) {
    case 0: return kernelCos(rest);
    case 1: return -kernelSin(rest);
    case 2: return -kernelCos(rest);
    default: return kernelSin(rest);
  }
}

/** Arctangent of x >= 0. */
function atanPositive(x: number): number {
  let hi = 0;
  let lo = 0;
  let t = x;
  let reduced = true;
  if (x < 0.4375) reduced = false;
  else if (x < 0.6875) { hi = 4.63647609000806093515e-1; lo = 2.26987774529616870924e-17; t = (2 * x - 1) / (2 + x); }
  else if (x < 1.1875) { hi = 7.85398163397448278999e-1; lo = 3.06161699786838301793e-17; t = (x - 1) / (x + 1); }
  else if (x < 2.4375) { hi = 9.82793723247329054082e-1; lo = 1.39033110312309984516e-17; t = (x - 1.5) / (1 + 1.5 * x); }
  else { hi = 1.57079632679489655800; lo = 6.12323399573676603587e-17; t = -1 / x; }
  const z = t * t;
  const w = z * z;
  const s1 = z * (3.33333333333329318027e-1 + w * (1.42857142725034663711e-1 + w * (9.09088713343650656196e-2 + w * (6.66107313738753120669e-2 + w * (4.97687799461593236017e-2 + w * 1.62858201153657823623e-2)))));
  const s2 = w * (-1.99999999998764832476e-1 + w * (-1.11111104054623557880e-1 + w * (-7.69187620504482999495e-2 + w * (-5.83357013379057348645e-2 + w * -3.65315727442169155270e-2))));
  return reduced ? hi - (t * (s1 + s2) - lo - t) : t - t * (s1 + s2);
}

export function atan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const a = Math.abs(y);
  const b = Math.abs(x);
  const first = b === 0 ? PIO2_HI + PIO2_LO : atanPositive(a / b);
  const angle = x >= 0 ? first : 3.141592653589793 - first;
  return y < 0 ? -angle : angle;
}

export function hypot(...values: readonly number[]): number {
  let sum = 0;
  for (const value of values) sum += value * value;
  return Math.sqrt(sum);
}

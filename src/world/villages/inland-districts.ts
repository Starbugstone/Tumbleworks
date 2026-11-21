type LandUse = 'lane' | 'yard' | 'garden';
type District = readonly [use: LandUse, x: number, z: number, halfWidth: number, halfDepth: number];

/** Connected occupation of the banks and terraces. The summit and ravine have their own materials. */
export const inlandDistricts: Partial<Record<number, readonly District[]>> = {
  3: [
    ['yard', -5.2, -12.3, 5.1, 2.43], ['yard', 5.72, -12.08, 4.1, 2.42],
    ['lane', -10.32, -6.8, 2.27, 5.6], ['lane', 10.7, -4.8, 2.45, 6.9],
    ['garden', -8.4, 2.35, 4.0, 6.0], ['garden', 8.8, 2.8, 4.6, 6.0],
    ['garden', -.15, -4.55, 7.41, 5.95], ['garden', -.36, 3.7, 7.6, 3.72],
    ['lane', -.60, 9.62, 10.35, 2.32],
    ['yard', -5.3, 12.28, 4.6, 2.38], ['yard', 4.15, 12.12, 4.64, 2.51],
  ],
  4: [
    ['garden', -8.6, -7.42, 5.5, 7.76], ['garden', -6.10, -3.5, 4.80, 3.85],
    ['yard', 8.3, -9.12, 4.65, 4.64], ['garden', 7.85, -4.35, 5.05, 3.1],
    ['lane', -7.95, 5.85, 4.83, 5.42], ['yard', -7.55, 10.45, 4.9, 3.0],
    ['garden', 2.8, 5.3, 2.55, 4.45], ['yard', 8.6, 3.8, 5.05, 2.4],
    ['garden', 9.92, 7.68, 4.3, 3.1], ['yard', 8.19, 12.18, 5.67, 2.45],
    ['garden', 2.93, 12.3, 2.24, 3.10],
  ],
  5: [
    ['yard', -8.5, -11.7, 3.7, 2.6], ['lane', -.92, -11.8, 4.0, 2.13], ['yard', 7.9, -11.62, 4.5, 2.76],
    ['yard', -9.0, -5.92, 3.25, 2.62], ['lane', -1.55, -5.9, 4.3, 2.67], ['yard', 7.4, -5.85, 5.0, 2.48],
    ['yard', -8.95, -.37, 3.6, 2.95], ['yard', -.13, 0, 5.32, 2.95], ['lane', 8.66, -.34, 3.94, 2.9],
    ['lane', .09, 5.4, 12.2, 2.05], ['yard', -8.05, 10.02, 4.55, 3.7],
    ['lane', .7, 9.16, 5.13, 2.9], ['yard', 8.47, 9.86, 4.9, 3.79], ['yard', .4, 13.04, 6.4, 1.91],
  ],
};

export function districtEdge(chapter: number, use: LandUse): string {
  const number = (value: number) => value.toFixed(3);
  const edges = (inlandDistricts[chapter] ?? []).filter(([kind]) => kind === use)
    .map(([,x,z,width,depth]) => `yardEdge(p-vec2(${number(x)},${number(z)}),vec2(${number(width)},${number(depth)}))`);
  return edges.reduce((edge, next) => `min(${edge},${next})`, '100.');
}

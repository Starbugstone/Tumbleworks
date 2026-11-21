import type { VillageSceneryPiece } from '../village-plans';

type Lot = readonly [model:string, x:number, z:number, yaw:number, scale:number];

// Each row is a surveyed frontage or yard. Angles face its activity towards the lane.
const neighbourhoods: Record<number, readonly Lot[]> = {
  // Nursery terraces
  1: [
    ['palm-house', -7.4, -13.4, 0, 1.11],
    ['palm-house', 8.95, -13.25, 0, 0.9],
    ['potting-house', 6, -10, 0.05, 1.2],
    ['potting-house', -4, -13, 0.07, 0.87],
    ['planting-bed', 9.35, -10, -0.04, 1],
    ['planting-bed', 9.5, -8.2, -0.04, 0.85],
    ['planting-bed', -4, 2, 0.07, 0.9],
    ['planting-bed', -4, 9.8, 0.06, 0.92],
    ['planting-bed', -7, 13.8, 0.04, 0.95],
    ['gardener', 8.4, -11.55, -0.9, 0.88],
  ],
  // Mill and timber yard
  2: [
    ['pollard', -6.5, -5.5, 0, 1],
    ['pollard', -7.6, 4.6, 0.6, 1.1],
    ['pollard', 3.4, -8.2, -0.4, 0.95],
    ['pollard', -5.4, 9.4, 1.2, 1],
    ['grain-barn', 4, -13.6, 0.14, 1.22],
    ['grain-barn', 8, -13.6, -0.09, 1],
    ['timber-yard', 2, -11.35, -0.1, 1.02],
    ['grain-barn', -9.8, -4, 0.82, 0.91],
    ['timber-yard', -9.7, -6.7, 0.95, 0.86],
    ['timber-yard', 8.4, 11.7, -0.35, 1],
    ['pollard', 4, 11.8, -0.65, 0.76],
    ['pollard', -6.05, -13.6, 0.74, 0.74],
    ['miller', 1.55, -12.9, 0.6, 0.95],
  ],
  // Watchmakers’ crescent
  3: [
    ['civic-clock', 11.5, -9.2, -0.1, 0.96],
    ['dial-atelier', -5.7, -14.1, 0.23, 1.05],
    ['dial-atelier', -3.3, -14.4, 0.2, 1.18],
    ['dial-atelier', -0.8, -14.5, 0.06, 1],
    ['dial-atelier', 4, -13.9, -0.24, 0.93],
    ['dial-atelier', 6.15, -13.6, -0.28, 1.07],
    ['dial-atelier', -10.4, -9.8, 0.85, 1],
    ['dial-atelier', -11.6, -7.4, 0.85, 0.86],
    ['timber-yard', -10.9, 3.2, 0.95, 0.82],
    ['clock-court', -2.4, 12.7, 0.08, 0.9],
    ['clock-court', 3.8, 12.2, -0.3, 0.95],
    ['clock-court', -8.9, 4.7, 0.9, 0.82],
    ['horologist', -4.8, -12.6, 0.88, 0.92],
  ],
  // Mesa crofts
  4: [
    ['fell-cottage', 11.05, -9.5, -0.35, 0.92],
    ['fell-cottage', 7.3, -6.9, 0.22, 0.85],
    ['fell-cottage', 5.1, -2, -0.08, 0.9],
    ['sheepfold', 8.3, -2.2, 0.12, 0.88],
    ['sheepfold', -10, 7.3, -0.05, 0.87],
    ['fell-cottage', -7.1, 11.8, 0.22, 0.95],
    ['sheepfold', -4.45, 12.7, -0.15, 0.92],
    ['fell-cottage', -7.3, 7.1, 0.2, 0.78],
    ['fell-scrub', -10.1, -7.2, 0.35, 1.38],
    ['fell-scrub', -6.3, -3.85, -0.6, 1.05],
    ['fell-scrub', 4.45, 9, 0.25, 1.16],
    ['fell-scrub', 5.9, 13.3, 1.4, 1.1],
    ['fell-scrub', -6.8, -9.5, 0.88, 0.84],
    ['shepherd', -6.3, 13.3, -0.8, 0.95],
  ],
  // Bottle ovens and packing floor
  5: [
    ['bottle-kiln', -10.5, -12.6, 0.2, 1.6],
    ['bottle-kiln', -8.4, -6.2, 0.12, 1],
    ['bottle-kiln', 5.4, -12.85, 0, 1.45],
    ['bottle-kiln', 11, -10.1, 0.15, 1.11],
    ['annealing-shed', -9.9, -0.4, 0.7, 0.85],
    ['annealing-shed', 9.6, -0.2, -0.62, 1],
    ['glass-rack', -10.2, 1.95, 0.65, 0.85],
    ['glass-rack', 12, 8, 0.55, 0.77],
    ['glass-rack', 4.3, 6.6, -0.09, 1.08],
    ['glass-packing-house', -3.5, 6.5, 0.22, 1.1],
    ['glass-packing-house', 8.5, 6.4, -0.24, 0.86],
    ['annealing-shed', 1, -6.25, 0.07, 0.8],
    ['annealing-shed', -3.2, -12.95, -0.09, 1],
    ['bottle-kiln', 3, -6.5, 0, 0.82],
    ['glassworker', -9.3, -10.65, -0.3, 0.94],
  ],
};

export function inlandSettlement(chapter:number, at:(x:number,z:number)=>number): VillageSceneryPiece[] {
  return neighbourhoods[chapter]!.map(([model,x,z,yaw,scale])=>({model,position:[x,at(x,z),z],yaw,scale}));
}

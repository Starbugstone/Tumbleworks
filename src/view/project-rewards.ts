import * as THREE from 'three';
import recipesRaw from '../../assets/world-3d/project-recipes.json?raw';
import type { ProjectReward } from '../world/workshop-projects';
import type { WorldAssets } from './world-assets';

interface Piece { model: string; position: [number, number, number]; scale: [number, number, number]; rotation: [number, number, number] }
const recipes: unknown = JSON.parse(recipesRaw);
function recipe(reward: ProjectReward): readonly Piece[] {
  if (!recipes || typeof recipes !== 'object' || !(reward in recipes)) throw new Error(`Unknown workshop reward: ${reward}`);
  const pieces: unknown = Reflect.get(recipes, reward);
  if (!Array.isArray(pieces)) throw new Error('Invalid workshop composition');
  return pieces.map((value: unknown): Piece => {
    if (!value || typeof value !== 'object') throw new Error('Invalid workshop piece');
    const model: unknown = Reflect.get(value, 'model');
    const triple = (key: string): [number, number, number] => {
      const vector: unknown = Reflect.get(value, key);
      if (!Array.isArray(vector) || vector.length !== 3 || !vector.every(item => typeof item === 'number' && Number.isFinite(item))) throw new Error('Invalid workshop transform');
      return [vector[0], vector[1], vector[2]];
    };
    if (typeof model !== 'string') throw new Error('Invalid workshop model');
    return { model, position: triple('position'), scale: triple('scale'), rotation: triple('rotation') };
  });
}

/** Permanent details use the same compositions as their Blender-rendered Atelier previews. */
export function createProjectReward(reward: ProjectReward, assets: Pick<WorldAssets, 'model'>, material: THREE.Material): THREE.Group {
  const group = new THREE.Group(); group.name = `project-${reward}`;
  for (const piece of recipe(reward)) {
    const model = assets.model(piece.model, material);
    model.position.fromArray(piece.position); model.scale.fromArray(piece.scale); model.rotation.set(...piece.rotation);
    group.add(model);
  }
  return group;
}

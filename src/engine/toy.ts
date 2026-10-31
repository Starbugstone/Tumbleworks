import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const toyMaterial = (color: number, roughness = 0.34): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 0.55, clearcoatRoughness: 0.22 });

export function toyBox(width: number, height: number, depth: number, color: number, radius = 0.12): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, radius), toyMaterial(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function label(text: string, width = 1.1, color = '#3b4069'): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot draw a board label');
  context.font = '600 52px Fredoka, sans-serif';
  const measured = context.measureText(text).width;
  if (measured > 176) context.font = `600 ${Math.floor(52 * 176 / measured)}px Fredoka, sans-serif`;
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 96, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 2),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

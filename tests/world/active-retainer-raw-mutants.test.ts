import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { BufferGeometry, Mesh, Ray, Triangle, Vector3 } from 'three';
import { activeRetainerHit, finiteBar } from './active-retainer-occlusion';
import { surfaceTriangles } from './surface-overlap';

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected preserved witness record'); return value as RecordValue; }
function vector(value: unknown): Vector3 { if (!Array.isArray(value) || value.length !== 3 || !value.every(n => typeof n === 'number' && Number.isFinite(n))) throw new Error('Expected finite witness vector'); return new Vector3(value[0], value[1], value[2]); }
function array(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('Expected witness array'); return value; }
function read(path: string): unknown { return JSON.parse(readFileSync(`output/current/village-layouts/${path}`, 'utf8')); }
function assertForeign(hit: RecordValue, eye: Vector3, target: Vector3, kind: 'centre' | 'rim') {
  const vertices = array(hit['triangle']).map(vector); expect(vertices).toHaveLength(3);
  const triangle = new Triangle(vertices[0]!, vertices[1]!, vertices[2]!);
  const intersection = new Ray(eye, target.clone().sub(eye).normalize()).intersectTriangle(triangle.a, triangle.b, triangle.c, false, new Vector3());
  expect(intersection, 'raw direct triangle oracle must reproduce the historical blocker').not.toBeNull();
  expect(intersection!.distanceTo(eye)).toBeLessThan(target.distanceTo(eye) - .002);
  const mesh = new Mesh(new BufferGeometry().setFromPoints(vertices)); mesh.name = String(hit['name'] ?? hit['parent']);
  expect(finiteBar(mesh, surfaceTriangles(mesh))).toBeUndefined();
  expect(activeRetainerHit({kind, eye, target, hit: intersection!, mesh}).kind).toBe('foreign');
}

it('replays the original front-yoke raw world triangle through the direct oracle and rejects it as a retainer', () => {
  const report = record(read('gardens-visibility26/contact-rim-source930-before-yoke.json'));
  const failure = record(array(report['failures'])[0]), ray = record(array(failure['rays'])[0]), hit = record(array(ray['foreign'])[0]);
  const actual = record(read('gardens-visibility26/source9-browser-repro/actual.json'));
  const eye = vector(record(actual['camera'])['position']), silhouette = record(actual['silhouette']);
  const target = vector(array(silhouette['rimPoints'])[0]);
  expect(hit['name']).toBe('village-9-carrier-BoxGeometry-8'); assertForeign(hit, eye, target, 'rim');
});

it('replays the original carrier4 underpass raw world triangle; its centre remains unconditionally foreign', () => {
  const report = record(read('gardens-final25/occlusion-repro.json')), row = record(array(report['rows'])[0]);
  const hit = record(array(row['hits'])[0]); expect(hit['parent']).toBe('village-4-carrier');
  assertForeign(hit, vector(row['camera']), vector(row['center']), 'centre');
});

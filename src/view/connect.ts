import * as THREE from 'three';
import { BoardView } from '../engine/board-view';
import type { GameServices } from '../engine/contracts';
import type { Point3 } from '../engine/physics';
import { label, toyBox, toyMaterial } from '../engine/toy';
import { connectPieces, type ConnectDef, type ConnectState } from '../puzzles/connect';

const RADIUS = 0.55;
const SPACING = 1.16;
export class ConnectView extends BoardView {
  private readonly pieces;
  private readonly rows;
  constructor(services: GameServices, readonly definition: ConnectDef, state: ConnectState) {
    super(services, 1.5);
    this.pieces = connectPieces(definition);
    this.rows = Math.max(...definition.columns.map((column) => column.length));
    const width = definition.columns.length * SPACING + 0.8;
    const depth = this.rows * SPACING + 1.2;
    const plinth = toyBox(width, 0.55, depth, 0xfdf5e6, 0.24);
    plinth.position.set(0, 0.35, 0);
    this.board.add(plinth);
    for (const x of [-width / 2, width / 2]) {
      const rail = toyBox(0.15, 0.3, depth, 0x3b4069);
      rail.position.set(x, 0.72, 0);
      this.board.add(rail);
    }
    const tag = label('CONNECT 3+', 2.7);
    tag.position.set(0, 0.65, depth / 2 - 0.2);
    this.board.add(tag);
    for (let column = 0; column < definition.columns.length; column++) for (let slot = 0; slot < this.rows; slot++) {
      const at = this.position(column, slot);
      const seat = new THREE.Mesh(new THREE.TorusGeometry(RADIUS * 0.78, 0.035, 6, 24), toyMaterial(0xd7c9b0));
      seat.rotation.x = -Math.PI / 2;
      seat.position.set(at.x, 0.65, at.z);
      this.board.add(seat);
    }
    this.rebuild(state);
    this.resize();
  }
  private position(column: number, slot: number): Point3 {
    return { x: (column - (this.definition.columns.length - 1) / 2) * SPACING,
      y: 1.16, z: ((this.rows - 1) / 2 - slot) * SPACING - 0.25 };
  }
  rebuild(state: ConnectState): void { this.cancelMotion(); this.layout(state); }
  private layout(state: ConnectState, animate = false): void {
    this.clearActors();
    this.syncMarbles(state.columns.flatMap((column, x) => column.flatMap((id, slot) => {
      const piece = this.pieces[id];
      return piece ? [{ id: String(id), color: piece.color, radius: RADIUS, at: this.position(x, slot), target: `piece${id}` }] : [];
    })), animate);
    state.columns.forEach((column, x) => column.forEach((id, slot) => {
      const neighbors: readonly [number, number][] = [[x + 1, slot], [x, slot + 1]];
      for (const [nextColumn, nextSlot] of neighbors) {
        const other = state.columns[nextColumn]?.[nextSlot];
        if (other === undefined || this.pieces[other]?.color !== this.pieces[id]?.color) continue;
        const a = this.position(x, slot);
        const b = this.position(nextColumn, nextSlot);
        const link = toyBox(Math.abs(a.x - b.x) + 0.12, 0.08, Math.abs(a.z - b.z) + 0.12, 0x3b4069, 0.035);
        link.position.set((a.x + b.x) / 2, 0.72, (a.z + b.z) / 2);
        this.actors.add(link);
      }
    }));
  }
  cleared(ids: readonly number[], state: ConnectState): void {
    const entries = ids.flatMap((id) => {
      const piece = this.pieces[id];
      const at = this.marblePosition(String(id));
      return piece && at ? [{ color: piece.color, at }] : [];
    });
    this.layout(state, true);
    this.burst(entries, RADIUS);
  }
}

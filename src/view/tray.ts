import * as THREE from 'three';
import { BoardView } from '../engine/board-view';
import type { GameServices } from '../engine/contracts';
import type { Point3 } from '../engine/physics';
import { label, toyBox, toyMaterial } from '../engine/toy';
import { availableTrayPieces } from '../puzzles/rules';
import type { TrayDef, TrayPickResult, TrayState } from '../puzzles/types';

const RADIUS = 0.62;
const rackPoint = (slot: number): Point3 => ({ x: (slot - 3) * 1.16, y: 1.08, z: 6.0 });

export class TrayView extends BoardView {

  constructor(services: GameServices, readonly definition: TrayDef, state: TrayState) {
    super(services, 1.5);
    const plinth = toyBox(10, 0.55, 10.8, 0xfdf5e6, 0.24);
    plinth.position.set(0, 0.35, -0.4);
    this.board.add(plinth);
    const border = toyMaterial(0xf25f33);
    for (const x of [-4.85, 4.85]) {
      const rail = toyBox(0.18, 0.4, 10.4, 0xf25f33);
      rail.position.set(x, 0.72, -0.4);
      this.board.add(rail);
    }
    const rack = toyBox(9.8, 0.5, 1.95, 0x3b4069, 0.2);
    rack.position.set(0, 0.5, 6);
    this.board.add(rack);
    const pocketGeometry = new THREE.TorusGeometry(0.48, 0.065, 8, 24);
    for (let slot = 0; slot < 7; slot++) {
      const pocket = new THREE.Mesh(pocketGeometry, toyMaterial(0xfdf5e6));
      const at = rackPoint(slot);
      pocket.rotation.x = -Math.PI / 2;
      pocket.position.set(at.x, 0.79, at.z);
      this.board.add(pocket);
    }
    const tag = label('MATCH 3', 2.2, '#fff9ee');
    tag.position.set(0, 0.79, 7.03);
    this.board.add(tag);
    for (const piece of definition.pieces) {
      const seat = new THREE.Mesh(new THREE.TorusGeometry(RADIUS * 0.75, 0.05, 8, 24), piece.layer ? border : toyMaterial(0xd7c9b0));
      seat.rotation.x = -Math.PI / 2;
      seat.position.set(piece.x, 0.68 + piece.layer * 0.85, piece.z);
      this.board.add(seat);
    }
    this.rebuild(state);
    this.resize();
  }

  private position(id: number): Point3 {
    const piece = this.definition.pieces.find((value) => value.id === id);
    if (!piece) throw new Error(`No tray piece ${id}`);
    return { x: piece.x, y: 1.1 + piece.layer * 0.85, z: piece.z };
  }

  rebuild(state: TrayState, rack = state.rack): void {
    this.clearActors();
    const available = new Set(availableTrayPieces(this.definition, state));
    for (const id of state.remaining) {
      const piece = this.definition.pieces.find((value) => value.id === id);
      if (!piece) continue;
      const entity = this.marble(piece.color, RADIUS, this.position(id), `piece${id}`);
      if (!available.has(id)) {
        // Keep the color visible beneath the cover, but mark the piece as unavailable.
        const cover = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.055, 8, 20), toyMaterial(0x86775f));
        cover.rotation.x = -Math.PI / 2;
        cover.position.copy(entity.mesh.position).add(new THREE.Vector3(0, 0.6, 0));
        this.actors.add(cover);
      }
    }
    rack.forEach((id, slot) => {
      const piece = this.definition.pieces.find((value) => value.id === id);
      if (piece) this.marble(piece.color, 0.48, rackPoint(slot));
    });
  }

  picked(id: number, result: Extract<TrayPickResult, { ok: true }>, beforeRack: readonly number[], state: TrayState): void {
    this.rebuild(state, [...beforeRack]);
    this.transferMarble(result.color, 0.48, this.position(id), rackPoint(beforeRack.length), () => {
      this.rebuild(state);
      if (result.clearedIds.length) {
        const oldRack = [...beforeRack, id];
        const entries = result.clearedIds.flatMap((pieceId) => {
          const piece = this.definition.pieces.find((value) => value.id === pieceId);
          return piece ? [{ color: piece.color, at: rackPoint(oldRack.indexOf(pieceId)) }] : [];
        });
        this.burst(entries, 0.48);
      }
    });
  }
}

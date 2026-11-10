import type { MachineRules } from './rules';

/** What a forked-shelf board shows: padlocked crates and one strap per blocker still in place. */
export interface ShelfMarks {
  /** Crates that cannot be tipped yet, by stable crate ID. */
  readonly locked: readonly number[];
  /** `[blocker, locked]`: the blocker must be tipped before the locked crate opens. */
  readonly straps: readonly (readonly [blocker: number, locked: number])[];
}

const NONE: ShelfMarks = { locked: [], straps: [] };

/**
 * Follows accepted rule state only, never animation: a strap goes the moment its blocker's release is accepted.
 * Column boards keep their sliding queue and show nothing.
 */
export function shelfMarks(rules: MachineRules): ShelfMarks {
  if (!rules.board.predecessors) return NONE;
  const waiting = rules.state.supplies.flat().map((packet) => packet.id).sort((a, b) => a - b);
  const unreleased = new Set(waiting);
  const locked = waiting.filter((id) => !rules.accessible(id));
  const straps = locked.flatMap((id) => rules.predecessors(id).filter((before) => unreleased.has(before)).map((before) => [before, id] as const));
  return { locked, straps };
}

/**
 * Paired boards keep columns: a tap anywhere on a column means its front crate, as on every classic board, so a raised back
 * crate is never a silent trap. Shelf boards have no columns to fall back on and keep each crate's own action.
 */
export function columnTap(rules: MachineRules, id: number): number {
  if (rules.board.predecessors || !rules.crateActions) return id;
  const column = rules.state.supplies.find((queue) => queue.some((packet) => packet.id === id));
  return column?.[0]?.id ?? id;
}

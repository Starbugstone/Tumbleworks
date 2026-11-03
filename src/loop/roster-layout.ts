/**
 * The lorry cards' one layout rule: from a level's shape and the viewport to every size on screen. No case tables, so
 * later levels with more lanes or longer queues need nothing new. What gives, in order: the toy's height down to its
 * floor, then row height down to its floor, then the lorries furthest back in a line fold into a "+n" tile. The docked
 * lorry and the next one always keep their numbers.
 */
export interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export interface CardBox { readonly x: number; readonly width: number; readonly truck: number }
export interface LanePlacement { readonly cards: readonly CardBox[]; readonly foldedFrom: number | null; readonly foldX: number }
export interface RosterLayout {
  readonly wide: boolean;
  readonly ruleWidth: number;
  readonly toy: Rect;
  readonly panel: Rect;
  readonly rowHeight: number;
  readonly fillHeight: number;
  readonly numberSize: number;
  /** Width of the docked lorry's card, the same on every lane so the rows stay tidy. */
  readonly nowWidth: number;
  /** Width beside the lane number that cards share. */
  readonly cardsWidth: number;
}

export const ROSTER = {
  top: 52, bottom: 80, compactBottom: 64, margin: 8, tag: 18, cardGap: 5, rowGap: 4, foldWidth: 30, seam: 8,
  rowTall: 46, rowShort: 40, rowTiny: 30, toyFloor: 150,
  cabNow: 22, cabWaiting: 16, stretchLeast: 22, stretchGap: 2,
  /** Card padding plus the rail around the colours. */
  chrome: 14,
  fillRowChrome: 9,
} as const;

/** The narrowest card that can print this many stretches without clipping a number. */
export const cardNeed = (stretches: number, cab: number): number =>
  cab + ROSTER.chrome + stretches * ROSTER.stretchLeast + Math.max(0, stretches - 1) * ROSTER.stretchGap;

/** `lines` is one list per lane, front lorry first, of how many stretches each lorry prints, free room included. */
export function rosterLayout(lines: readonly (readonly number[])[], width: number, height: number, hasLatches = false): RosterLayout {
  const ruleWidth = hasLatches ? 26 : 0;
  const compact = height < 600 && width > 600;
  const bottom = compact ? ROSTER.compactBottom : ROSTER.bottom;
  const usable = height - ROSTER.top - bottom;
  const wide = width > height;
  const panelWidth = wide ? Math.min(560, Math.max(340, width * 0.46)) : width;
  const cardsWidth = panelWidth - ROSTER.margin * 2 - ROSTER.tag;
  const rows = lines.length;
  const gaps = ROSTER.rowGap * Math.max(0, rows - 1);
  const toyFloor = wide ? 0 : Math.min(ROSTER.toyFloor, usable * 0.27);
  const floor = compact ? ROSTER.rowTiny : ROSTER.rowShort;
  const rowHeight = Math.max(floor, Math.min(ROSTER.rowTall, (usable - toyFloor - (wide ? 0 : ROSTER.seam) - gaps) / rows));
  const panelHeight = rowHeight * rows + gaps;
  const numberSize = rowHeight >= 44 ? 13 : rowHeight >= 38 ? 12 : 11;
  const fillHeight = Math.max(8, rowHeight - ROSTER.fillRowChrome - numberSize - 2);

  // The docked card takes what the longest line leaves, within limits: it is where a player looks first.
  // A docked lorry can open a stretch of free room during play; a fifth stretch prints tight rather than shrink every level.
  const docked = Math.min(4, Math.max(...lines.flat(), 1) + 1);
  const least = cardNeed(docked, ROSTER.cabNow) + ruleWidth;
  const anyFollowers = lines.some((line) => line.length > 1);
  const demand = Math.max(0, ...lines.map((line) => line.slice(1).reduce((sum, stretches, index) => sum + cardNeed(stretches, ROSTER.cabWaiting) + ruleWidth + (index ? ROSTER.cardGap : 0), 0)));
  const nowWidth = anyFollowers ? Math.max(least, Math.min(cardsWidth * 0.58, cardsWidth - demand - ROSTER.cardGap)) : Math.min(cardsWidth, 300);

  const toyHeight = wide ? usable : Math.max(0, usable - panelHeight - ROSTER.seam);
  return {
    wide, ruleWidth, rowHeight, fillHeight, numberSize, nowWidth, cardsWidth,
    toy: wide ? { x: 0, y: ROSTER.top, width: width - panelWidth, height: usable } : { x: 0, y: ROSTER.top, width, height: toyHeight },
    panel: wide
      ? { x: width - panelWidth, y: ROSTER.top + Math.max(0, (usable - panelHeight) / 2), width: panelWidth, height: panelHeight }
      : { x: 0, y: ROSTER.top + toyHeight + ROSTER.seam, width, height: panelHeight },
  };
}

/** Places a lane's cards: the docked one, then as many followers as fit, the rest folded. `line` is front lorry first. */
export function placeLane(line: readonly number[], layout: RosterLayout, capacityRatios: readonly number[] = []): LanePlacement {
  if (!line.length) return { cards: [], foldedFrom: null, foldX: 0 };
  const cards: CardBox[] = [{ x: 0, width: layout.nowWidth, truck: 0 }];
  const start = layout.nowWidth + ROSTER.cardGap;
  const room = layout.cardsWidth - start;
  const needs = line.slice(1).map((stretches) => cardNeed(stretches, ROSTER.cabWaiting) + layout.ruleWidth);
  let shown = 0, used = 0;
  for (; shown < needs.length; shown++) {
    const more = needs.length - shown - 1 > 0 ? ROSTER.foldWidth + ROSTER.cardGap : 0;
    const next = used + needs[shown]! + (shown ? ROSTER.cardGap : 0);
    // The next lorry always shows, even if it has to print tight.
    if (shown > 0 && next + more > room) break;
    used = next;
  }
  const folded = needs.length - shown;
  const available = room - (folded ? ROSTER.foldWidth + ROSTER.cardGap : 0) - ROSTER.cardGap * Math.max(0, shown - 1);
  const total = needs.slice(0, shown).reduce((sum, need) => sum + need, 0) || 1;
  let x = start;
  for (let at = 0; at < shown; at++) {
    const width = Math.max(0, (needs[at]! / total) * available);
    cards.push({ x, width, truck: at + 1 });
    x += width + ROSTER.cardGap;
  }
  let cursor = 0;
  const sized = cards.map((card) => {
    const ratio = capacityRatios[card.truck] ?? 1;
    const cab = card.truck === 0 ? ROSTER.cabNow : ROSTER.cabWaiting;
    const fixed = cab + ROSTER.chrome + layout.ruleWidth;
    const width = Math.min(card.width, Math.max(cardNeed(line[card.truck]!, cab) + layout.ruleWidth, fixed + (card.width - fixed) * ratio));
    const result = { ...card, x: cursor, width };
    cursor += width + ROSTER.cardGap;
    return result;
  });
  return { cards: sized, foldedFrom: folded ? shown + 1 : null, foldX: cursor };
}

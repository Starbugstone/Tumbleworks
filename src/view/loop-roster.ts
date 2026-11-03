import { bedSpans, sharePercent } from '../loop/layout';
import type { LoopMachine } from '../loop/machine';
import { type LanePlacement, placeLane, ROSTER, type Rect, rosterLayout, type RosterLayout } from '../loop/roster-layout';
import type { Color } from '../sim/types';
import { COLORS, cargoInk, drawSymbol } from './art';

const INK = '#202335', IVORY = '#fff9ee';
const icons = new Map<string, string>();
/** A container pattern as an image, drawn by the same code as every other pattern in the game. */
function pattern(color: Color, ink: string): string {
  const key = `${color}:${ink}`;
  let url = icons.get(key);
  if (!url) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d');
    if (!context) return '';
    context.fillStyle = ink;
    drawSymbol(context, color, 32, 32, 26);
    url = canvas.toDataURL();
    icons.set(key, url);
  }
  return url;
}

// Neutral cargo needs an edge against both the ivory current card and its dark rail.
const cargoEdge = (color: Color): string => color === 'white' ? `inset 0 0 0 1px ${INK}`
  : color === 'black' ? `inset 0 0 0 1px ${COLORS.black.light}` : '';

const STYLE = `
.lr { position: fixed; inset: 0; pointer-events: none; font-family: Fredoka, "Trebuchet MS", sans-serif; }
.lr-tag, .lr-pin { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: ${IVORY}; color: ${INK}; display: grid; place-items: center; font-weight: 600; font-size: 12px; line-height: 1; }
.lr-pin { transform: translate(-50%, -50%); box-shadow: 0 1px 3px rgb(0 0 0 / 0.45); }
.lr-card { position: absolute; display: flex; gap: 3px; padding: 3px 4px 2px 3px; border-radius: 9px; box-sizing: border-box; transition: left 0.24s ease, width 0.24s ease, opacity 0.2s ease; }
.lr-card.now { background: ${IVORY}; color: ${INK}; box-shadow: 0 3px 0 #b9a98a, 0 5px 8px rgb(0 0 0 / 0.35); }
.lr-card.waiting { background: rgb(8 18 34 / 0.62); color: #eef2f5; }
.lr-card.leaving { opacity: 0; }
.lr-card.pouring { outline: 2px solid ${IVORY}; outline-offset: 2px; }
.lr-cab { flex: none; position: relative; border-radius: 7px 3px 3px 7px; display: grid; place-items: center; }
.lr-cab img { width: 76%; aspect-ratio: 1; object-fit: contain; }
.lr-card.now .lr-cab::after { content: ""; position: absolute; left: 3px; right: 3px; bottom: -5px; height: 7px; background: radial-gradient(circle at 25% 50%, #20243a 3px, transparent 3.5px), radial-gradient(circle at 75% 50%, #20243a 3px, transparent 3.5px); }
.lr-load { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.lr-rail { flex: none; background: #15243a; border-radius: 5px; padding: 2px; display: flex; gap: ${ROSTER.stretchGap}px; }
.lr-fill { flex: none; box-sizing: border-box; border-radius: 3px; display: grid; place-items: center; transition: width 0.18s linear; overflow: hidden; }
.lr-fill img { width: var(--pattern); height: var(--pattern); max-width: 100%; object-fit: contain; }
.lr-fill.free { border: 1.5px dashed #8fa3b5; }
.lr-numbers { display: flex; gap: ${ROSTER.stretchGap}px; padding: 0 2px; }
.lr-number { flex: none; box-sizing: border-box; text-align: center; white-space: nowrap; font-weight: 600; transition: width 0.18s linear; }
.lr-number small { font-size: 0.68em; font-weight: 500; opacity: 0.8; }
.lr-number.free { opacity: 0.75; }
.lr-state { position: absolute; right: 7px; top: 6px; width: 12px; height: 12px; }
.lr-fold { position: absolute; display: grid; place-items: center; border-radius: 9px; background: rgb(8 18 34 / 0.62); color: #eef2f5; font-weight: 600; font-size: 12px; transition: left 0.24s ease; }
.lr-peek { position: absolute; display: flex; flex-direction: column; gap: 4px; padding: 6px; border-radius: 11px; background: #0d1b2e; box-shadow: 0 4px 14px rgb(0 0 0 / 0.5); }
.lr-peek .lr-card { position: relative; }
@media (prefers-reduced-motion: reduce) { .lr-card, .lr-fill, .lr-number, .lr-fold { transition: none; } }
`;

interface Stretch { readonly color: Color | null; readonly units: number }
interface Lorry { readonly truck: number; readonly finalColor: Color; readonly stretches: readonly Stretch[]; readonly state: 'pouring' | 'waiting' | null }
interface CardView { readonly element: HTMLElement; readonly cab: HTMLElement; readonly rail: HTMLElement; readonly numbers: HTMLElement; signature: string; truckKey: string }
export interface RosterPick { readonly lane: number; readonly kind: 'now' | 'waiting' | 'more' }
const CHEVRONS = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path fill="none" stroke="${INK}" stroke-width="2" d="M2 2l4 4-4 4M6.5 2l4 4-4 4"/></svg>`);
const PAUSE = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><path fill="${INK}" d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z"/></svg>`);

/** The lorry cards under the toy: one row per lane, each lorry a card heading left with the next one following it. */
export class LoopRoster {
  private readonly element = document.createElement('div');
  private readonly style = document.createElement('style');
  private readonly cards = new Map<string, CardView>();
  private readonly tags: HTMLElement[] = [];
  private readonly folds: HTMLElement[] = [];
  private readonly pins: HTMLElement[] = [];
  private readonly levelLines: number[][];
  private layoutNow: RosterLayout;
  private key = '';
  private peek: { lane: number; element: HTMLElement } | null = null;

  constructor(private readonly machine: LoopMachine) {
    this.element.className = 'lr';
    this.element.setAttribute('aria-hidden', 'true');
    this.style.textContent = STYLE;
    document.head.append(this.style);
    document.body.insertBefore(this.element, document.getElementById('hud'));
    const capacity = machine.board.truckCapacity;
    // The level's own shape sets the sizes, so they hold still for the whole level.
    this.levelLines = machine.board.lanes.map((line) => line.map((truck) => truck.segments.length + (truck.segments.reduce((sum, s) => sum + s.count, 0) < capacity ? 1 : 0)));
    this.layoutNow = rosterLayout(this.levelLines, window.innerWidth, window.innerHeight);
    machine.board.lanes.forEach((_, lane) => {
      const tag = document.createElement('span');
      tag.className = 'lr-tag'; tag.textContent = String(lane + 1);
      const fold = document.createElement('span');
      fold.className = 'lr-fold'; fold.hidden = true;
      const pin = document.createElement('span');
      pin.className = 'lr-pin'; pin.textContent = String(lane + 1);
      this.tags.push(tag); this.folds.push(fold); this.pins.push(pin);
      this.element.append(tag, fold, pin);
    });
  }

  /** Sizes everything for the viewport and answers with the rectangle the toy may fill. */
  layout(width: number, height: number): Rect {
    this.layoutNow = rosterLayout(this.levelLines, width, height);
    this.key = '';
    this.closePeek();
    this.sync();
    // Toasts float above the cards rather than over them.
    if (this.layoutNow.wide) document.documentElement.style.removeProperty('--toast-bottom');
    else document.documentElement.style.setProperty('--toast-bottom', `${height - this.layoutNow.panel.y + 6}px`);
    return this.layoutNow.toy;
  }

  /** Marks each lane's lorry on the toy with the number of its row of cards. */
  placePins(at: (lane: number) => { x: number; y: number }): void {
    this.pins.forEach((pin, lane) => { const point = at(lane); pin.style.left = `${point.x}px`; pin.style.top = `${point.y}px`; });
  }

  private readLines(): Lorry[][] {
    const capacity = this.machine.board.truckCapacity;
    const trucks = this.machine.readTrucks();
    return this.machine.board.lanes.map((_, lane) => {
      const front = this.machine.rules.front(lane);
      const inLane = trucks.filter((truck) => truck.lane === lane);
      const docked = inLane.find((truck) => truck.index === front?.index);
      const waiting = inLane.filter((truck) => truck.queueSlot !== null && truck !== docked).sort((a, b) => a.queueSlot! - b.queueSlot!);
      return [...(docked ? [docked] : []), ...waiting].map((truck): Lorry => {
        const stretches: Stretch[] = [...truck.blocks].reverse().filter((block) => block.units > 0).map((block) => ({ color: block.color, units: block.units }));
        const load = stretches.reduce((sum, stretch) => sum + stretch.units, 0);
        if (load < capacity) stretches.push({ color: null, units: capacity - load });
        return { truck: truck.index, finalColor: truck.finalColor, stretches, state: truck === docked ? truck.unloading : null };
      });
    });
  }

  sync(): void {
    const lines = this.readLines();
    const key = JSON.stringify(lines);
    if (key === this.key) return;
    this.key = key;
    const layout = this.layoutNow;
    const live = new Set<string>();
    lines.forEach((line, lane) => {
      const y = layout.panel.y + lane * (layout.rowHeight + ROSTER.rowGap);
      const tag = this.tags[lane]!;
      tag.style.left = `${layout.panel.x + ROSTER.margin - 3}px`;
      tag.style.top = `${y + (layout.rowHeight - 18) / 2}px`;
      const placed = placeLane(line.map((lorry) => lorry.stretches.length), layout);
      this.placeCards(lane, line, placed, y, live);
      const fold = this.folds[lane]!;
      fold.hidden = placed.foldedFrom === null;
      if (placed.foldedFrom !== null) {
        const left = layout.panel.x + ROSTER.margin + ROSTER.tag;
        fold.textContent = `+${line.length - placed.foldedFrom}`;
        fold.dataset['lane'] = String(lane);
        Object.assign(fold.style, { left: `${left + placed.foldX}px`, top: `${y}px`, width: `${ROSTER.foldWidth}px`, height: `${layout.rowHeight}px` });
      }
    });
    for (const [id, view] of this.cards) {
      if (live.has(id)) continue;
      this.cards.delete(id);
      // The finished lorry's card slides out as the toy lorry lifts away, then the row moves up.
      view.element.classList.add('leaving');
      view.element.style.left = `${Number.parseFloat(view.element.style.left) - 40}px`;
      window.setTimeout(() => view.element.remove(), 260);
    }
    if (this.peek) { const lane = this.peek.lane; this.closePeek(); if (placeLane(lines[lane]!.map((lorry) => lorry.stretches.length), layout).foldedFrom !== null) this.openPeek(lane, lines[lane]!); }
  }

  private placeCards(lane: number, line: readonly Lorry[], placed: LanePlacement, y: number, live: Set<string>): void {
    const layout = this.layoutNow;
    const left = layout.panel.x + ROSTER.margin + ROSTER.tag;
    for (const box of placed.cards) {
      const lorry = line[box.truck]!;
      const id = `${lane}:${lorry.truck}`;
      live.add(id);
      let view = this.cards.get(id);
      if (!view) { view = this.makeCard(); this.cards.set(id, view); this.element.append(view.element); }
      const kind = box.truck === 0 ? 'now' : 'waiting';
      view.element.className = `lr-card ${kind}${lorry.state === 'pouring' ? ' pouring' : ''}`;
      view.element.dataset['lane'] = String(lane);
      view.element.dataset['truck'] = String(lorry.truck);
      view.element.dataset['kind'] = kind;
      view.element.style.left = `${left + box.x}px`;
      view.element.style.top = `${y}px`;
      view.element.style.width = `${box.width}px`;
      view.element.style.height = `${layout.rowHeight}px`;
      this.paint(view, lorry, box.width, kind);
    }
  }

  private makeCard(): CardView {
    const element = document.createElement('div');
    const cab = document.createElement('span'); cab.className = 'lr-cab';
    const load = document.createElement('div'); load.className = 'lr-load';
    const rail = document.createElement('div'); rail.className = 'lr-rail';
    const numbers = document.createElement('div'); numbers.className = 'lr-numbers';
    load.append(rail, numbers);
    element.append(cab, load);
    return { element, cab, rail, numbers, signature: '', truckKey: '' };
  }

  private paint(view: CardView, lorry: Lorry, width: number, kind: 'now' | 'waiting'): void {
    const layout = this.layoutNow;
    const capacity = this.machine.board.truckCapacity;
    const cab = kind === 'now' ? ROSTER.cabNow : ROSTER.cabWaiting;
    if (view.truckKey !== lorry.finalColor) {
      view.truckKey = lorry.finalColor;
      view.cab.style.background = COLORS[lorry.finalColor].base;
      view.cab.style.boxShadow = cargoEdge(lorry.finalColor);
      view.cab.innerHTML = `<img alt="" src="${pattern(lorry.finalColor, cargoInk(lorry.finalColor))}">`;
    }
    view.cab.style.width = `${cab}px`;
    const stretches = lorry.stretches;
    const signature = stretches.map((stretch) => stretch.color ?? 'free').join();
    if (signature !== view.signature) {
      view.signature = signature;
      view.rail.replaceChildren(...stretches.map((stretch) => {
        const fill = document.createElement('i');
        fill.className = `lr-fill${stretch.color ? '' : ' free'}`;
        if (stretch.color) { fill.style.background = COLORS[stretch.color].base; fill.style.boxShadow = cargoEdge(stretch.color); fill.innerHTML = `<img alt="" src="${pattern(stretch.color, cargoInk(stretch.color))}">`; }
        return fill;
      }));
      view.numbers.replaceChildren(...stretches.map((stretch) => {
        const number = document.createElement('b');
        number.className = `lr-number${stretch.color ? '' : ' free'}`;
        return number;
      }));
    }
    const inner = Math.max(0, width - cab - ROSTER.chrome - (stretches.length - 1) * ROSTER.stretchGap);
    const spans = bedSpans(stretches.map((stretch) => stretch.units), capacity, inner, Math.min(ROSTER.stretchLeast, inner / stretches.length));
    stretches.forEach((stretch, index) => {
      const fill = view.rail.children.item(index) as HTMLElement | null;
      const number = view.numbers.children.item(index) as HTMLElement | null;
      if (!fill || !number) return;
      fill.style.width = `${spans[index]}px`;
      fill.style.height = `${layout.fillHeight}px`;
      fill.style.setProperty('--pattern', `${Math.round(layout.fillHeight * 0.76)}px`);
      number.style.width = `${spans[index]}px`;
      number.style.fontSize = `${layout.numberSize}px`;
      number.style.lineHeight = `${layout.numberSize + 2}px`;
      const percent = String(sharePercent(stretch.units, capacity));
      if (number.dataset['percent'] !== percent) { number.dataset['percent'] = percent; number.innerHTML = `${percent}<small>%</small>`; }
    });
    let state = view.element.querySelector<HTMLImageElement>('.lr-state');
    if (lorry.state) {
      if (!state) { state = document.createElement('img'); state.className = 'lr-state'; state.alt = ''; view.element.append(state); }
      state.src = lorry.state === 'pouring' ? CHEVRONS : PAUSE;
    } else state?.remove();
  }

  /** What is under a screen point. The peek panel is on top of everything while it is open. */
  pick(x: number, y: number): RosterPick | null {
    const inside = (element: HTMLElement): boolean => { const r = element.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
    // The panel covers part of the toy: a tap on it only closes it, and must never reach a lorry underneath.
    if (this.peek && inside(this.peek.element)) return { lane: this.peek.lane, kind: 'more' };
    for (const fold of this.folds) if (!fold.hidden && inside(fold)) return { lane: Number(fold.dataset['lane']), kind: 'more' };
    for (const view of this.cards.values()) {
      if (!inside(view.element)) continue;
      return { lane: Number(view.element.dataset['lane']), kind: view.element.dataset['kind'] === 'now' ? 'now' : 'waiting' };
    }
    return null;
  }

  togglePeek(lane: number): void {
    const open = this.peek?.lane === lane;
    this.closePeek();
    if (!open) this.openPeek(lane, this.readLines()[lane]!);
  }

  closePeek(): void { this.peek?.element.remove(); this.peek = null; }

  /** The lorries folded behind a lane's "+n" tile, one gesture away, numbers and all. */
  private openPeek(lane: number, line: readonly Lorry[]): void {
    const layout = this.layoutNow;
    const placed = placeLane(line.map((lorry) => lorry.stretches.length), layout);
    if (placed.foldedFrom === null) return;
    const panel = document.createElement('div');
    panel.className = 'lr-peek';
    const width = layout.cardsWidth * 0.62;
    for (const lorry of line.slice(placed.foldedFrom)) {
      const view = this.makeCard();
      view.element.className = 'lr-card waiting';
      view.element.style.width = `${width}px`;
      view.element.style.height = `${layout.rowHeight}px`;
      this.paint(view, lorry, width, 'waiting');
      panel.append(view.element);
    }
    const count = line.length - placed.foldedFrom;
    const y = layout.panel.y + lane * (layout.rowHeight + ROSTER.rowGap);
    const height = count * layout.rowHeight + (count - 1) * 4 + 12;
    Object.assign(panel.style, { left: `${layout.panel.x + layout.panel.width - width - 20}px`, top: `${Math.max(ROSTER.top, y - height - 2)}px` });
    this.element.append(panel);
    this.peek = { lane, element: panel };
  }

  waitingBounds(): { lane: number; slot: number; visible: boolean; left: number; right: number; top: number; bottom: number }[] {
    const out: { lane: number; slot: number; visible: boolean; left: number; right: number; top: number; bottom: number }[] = [];
    for (const view of this.cards.values()) {
      if (view.element.dataset['kind'] !== 'waiting') continue;
      const r = view.element.getBoundingClientRect();
      out.push({ lane: Number(view.element.dataset['lane']), slot: Number(view.element.dataset['truck']), visible: true, left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
    return out;
  }

  /** Every printed number as the browser draws it, for the tests that hold it to a readable size. */
  printedNumbers(): { lane: number; waiting: boolean; font: number; clipped: boolean; text: string }[] {
    return [...this.cards.values()].flatMap((view) => [...view.numbers.children].map((child) => {
      const number = child as HTMLElement;
      return { lane: Number(view.element.dataset['lane']), waiting: view.element.dataset['kind'] === 'waiting', font: Number.parseFloat(getComputedStyle(number).fontSize), clipped: number.scrollWidth > number.clientWidth + 1, text: number.textContent ?? '' };
    }));
  }

  dockedCardHeight(): number { return this.layoutNow.rowHeight; }

  dispose(): void {
    this.closePeek();
    this.element.remove();
    this.style.remove();
    document.documentElement.style.removeProperty('--toast-bottom');
  }
}

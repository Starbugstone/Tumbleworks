import type { ScreenPoint } from './contracts';

interface PointerActions {
  pick(point: ScreenPoint): string | null;
  tap(target: string): void;
  start(target: string, point: ScreenPoint): boolean;
  move(point: ScreenPoint, target: string | null): void;
  end(target: string | null): void;
  cancel(): void;
  unlock(): void;
}

/** Capture belongs to the input layer; each gameplay decides what a drag means. */
export class BoardPointer {
  private gesture: { id: number; origin: ScreenPoint; target: string | null; moved: boolean; dragging: boolean } | null = null;
  constructor(private readonly canvas: HTMLCanvasElement, private readonly actions: PointerActions) {
    canvas.addEventListener('pointerdown', (event) => {
      if (this.gesture || event.button !== 0) return;
      this.actions.unlock();
      const origin = { x: event.clientX, y: event.clientY };
      this.gesture = { id: event.pointerId, origin, target: actions.pick(origin), moved: false, dragging: false };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      const gesture = this.gesture;
      if (!gesture || event.pointerId !== gesture.id) return;
      const point = { x: event.clientX, y: event.clientY };
      if (!gesture.moved && Math.hypot(point.x - gesture.origin.x, point.y - gesture.origin.y) >= 8) {
        gesture.moved = true;
        gesture.dragging = gesture.target !== null && actions.start(gesture.target, gesture.origin);
      }
      if (gesture.dragging) actions.move(point, actions.pick(point));
    });
    canvas.addEventListener('pointerup', (event) => {
      const gesture = this.gesture;
      if (!gesture || event.pointerId !== gesture.id) return;
      this.gesture = null;
      if (gesture.dragging) actions.end(actions.pick({ x: event.clientX, y: event.clientY }));
      else if (gesture.target && (!gesture.moved || actions.pick({ x: event.clientX, y: event.clientY }) === gesture.target)) actions.tap(gesture.target);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    });
    for (const type of ['pointercancel', 'lostpointercapture'] as const) canvas.addEventListener(type, (event) => {
      if (event.pointerId === this.gesture?.id) this.cancel();
    });
    window.addEventListener('blur', () => this.cancel());
  }

  cancel(): void {
    const gesture = this.gesture;
    this.gesture = null;
    if (!gesture) return;
    if (gesture.dragging) this.actions.cancel();
    if (this.canvas.hasPointerCapture(gesture.id)) this.canvas.releasePointerCapture(gesture.id);
  }
}

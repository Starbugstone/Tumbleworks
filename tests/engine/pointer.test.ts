import { afterEach, expect, it, vi } from 'vitest';
import { BoardPointer } from '../../src/engine/pointer';

afterEach(() => vi.unstubAllGlobals());

function gesture(drag = false) {
  vi.stubGlobal('window', new EventTarget());
  const canvas = Object.assign(new EventTarget(), {
    setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn(),
  });
  const actions = {
    unlock: vi.fn(), pick: ({ x }: { x: number }) => x < 150 ? 'piece0' : x < 250 ? 'piece1' : null,
    tap: vi.fn(), start: vi.fn(() => drag), move: vi.fn(), end: vi.fn(), cancel: vi.fn(),
  };
  new BoardPointer(canvas as unknown as HTMLCanvasElement, actions);
  const fire = (type: string, x = 100, pointerId = 1) => canvas.dispatchEvent(Object.assign(new Event(type), {
    pointerId, button: 0, clientX: x, clientY: 100,
  }));
  return { actions, fire };
}

it('accepts a small finger slide ending on the same non-draggable piece', () => {
  const { actions, fire } = gesture();
  fire('pointerdown'); fire('pointermove', 112); fire('pointerup', 112);
  expect(actions.tap).toHaveBeenCalledExactlyOnceWith('piece0');
  expect(actions.end).not.toHaveBeenCalled();
});

it.each([200, 300])('does not tap when a slide ends on a different or absent piece at %s', (x) => {
  const { actions, fire } = gesture();
  fire('pointerdown'); fire('pointermove', x); fire('pointerup', x);
  expect(actions.tap).not.toHaveBeenCalled();
});

it('a successful drag completes once without also tapping', () => {
  const { actions, fire } = gesture(true);
  fire('pointerdown'); fire('pointermove', 200); fire('pointerup', 200); fire('lostpointercapture');
  expect(actions.end).toHaveBeenCalledExactlyOnceWith('piece1');
  expect(actions.tap).not.toHaveBeenCalled();
  expect(actions.cancel).not.toHaveBeenCalled();
});

it('cancels only the pointer that owns the gesture', () => {
  const { actions, fire } = gesture(true);
  fire('pointerdown'); fire('pointermove', 200); fire('pointercancel', 200, 2);
  expect(actions.cancel).not.toHaveBeenCalled();
  fire('pointercancel', 200); fire('lostpointercapture', 200);
  expect(actions.cancel).toHaveBeenCalledOnce();
  expect(actions.tap).not.toHaveBeenCalled();
  expect(actions.end).not.toHaveBeenCalled();
});

/**
 * Display frames closer together than this are skipped, so 120 and 144 Hz screens draw at 60 and 72 fps
 * and a 90 Hz screen at 45; a 60 Hz screen draws every frame. Half the frames is half the work that heats
 * a phone, and the fixed-tick simulation is unaffected: it catches up by elapsed time.
 */
export const MIN_FRAME_MS = 12.5;

/** Whether the display frame at `now` should run, the last one having run at `last`. */
export const frameDue = (now: number, last: number): boolean => now < last || now - last >= MIN_FRAME_MS;

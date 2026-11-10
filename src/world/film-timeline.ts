export const LOCAL_FILM_SECONDS = 25;
export const CONNECTION_SECONDS = 2.5;

/** Authored film time, independent of browser speed and the gameplay clock. */
export function filmTimeline(seconds: number): { travel: number; visible: boolean; cameraZ: number; zoom: number } {
  const travel = Math.max(0, Math.min(1, (seconds - 0.35) / 8.5));
  return { travel, visible: seconds >= 0.35 && seconds < 10.85, cameraZ: -3 + travel * 5, zoom: 1.14 };
}
export function mechanismMotion(seconds: number, index: number): { spin: number; tilt: number } {
  const arrival = 0.35 + (9 - index) / 9 * 8.5;
  const elapsed = Math.max(0, Math.min(2, seconds - arrival));
  return { spin: elapsed > 0 ? -elapsed * 2 : 0, tilt: Math.sin(elapsed / 2 * Math.PI) * 0.42 };
}

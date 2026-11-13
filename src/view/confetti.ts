const COLORS = ['#ff5a4f', '#3f7bff', '#17b79c', '#ffdc52', '#ff8a1c', '#ffffff', '#b9a8ff'];
const SECONDS = 2.1;

interface Piece { x: number; y: number; vx: number; vy: number; turn: number; spin: number; size: number; color: string; round: boolean }

/**
 * A level won: two cannons of paper from the bottom corners, over the board and under the card.
 * It is a flat canvas that exists only while paper is in the air, so play itself pays nothing for it.
 */
export function confetti(host?: HTMLElement): void {
  if (typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Without a host the paper flies on its own layer over whatever screen is showing, and takes the layer with it.
  const layer = host ? null : document.body.appendChild(document.createElement('div'));
  if (layer) layer.style.cssText = 'position:fixed;inset:0;z-index:50;pointer-events:none';
  host ??= layer!;
  host.replaceChildren();
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  const ratio = Math.min(devicePixelRatio, 1.5), width = innerWidth, height = innerHeight;
  canvas.width = width * ratio; canvas.height = height * ratio;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  const ctx = canvas.getContext('2d');
  if (!ctx) { layer?.remove(); return; }
  host.append(canvas);
  const pieces: Piece[] = Array.from({ length: 150 }, (_, index) => {
    const left = index % 2 === 0;
    const angle = (left ? -Math.PI / 3 : -Math.PI * 2 / 3) + (Math.random() - 0.5) * 0.9;
    const speed = height * (0.9 + Math.random() * 0.75);
    return { x: left ? -10 : width + 10, y: height * 0.82, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      turn: Math.random() * 6, spin: (Math.random() - 0.5) * 16, size: 6 + Math.random() * 7,
      color: COLORS[index % COLORS.length]!, round: index % 5 === 0 };
  });
  let last = performance.now(), age = 0;
  const frame = (now: number): void => {
    const seconds = Math.min(0.05, (now - last) / 1000);
    last = now; age += seconds;
    if (age >= SECONDS || !canvas.isConnected) { canvas.remove(); layer?.remove(); return; }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = Math.min(1, (SECONDS - age) * 2.5);
    for (const piece of pieces) {
      piece.vy += height * 1.7 * seconds;
      piece.vx *= 1 - 1.4 * seconds; piece.vy *= 1 - 0.9 * seconds;
      piece.x += piece.vx * seconds; piece.y += piece.vy * seconds; piece.turn += piece.spin * seconds;
      ctx.save();
      ctx.translate(piece.x, piece.y); ctx.rotate(piece.turn);
      ctx.fillStyle = piece.color;
      if (piece.round) { ctx.beginPath(); ctx.arc(0, 0, piece.size / 2, 0, Math.PI * 2); ctx.fill(); }
      // A strip that narrows as it turns reads as paper tumbling.
      else ctx.fillRect(-piece.size / 2, -piece.size / 4 * Math.abs(Math.cos(piece.turn * 1.7)), piece.size, piece.size / 2 * Math.abs(Math.cos(piece.turn * 1.7)) + 1);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

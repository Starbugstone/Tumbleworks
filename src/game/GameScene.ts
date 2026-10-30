import Phaser from 'phaser';
import { BOARDS } from '../sim/boards';
import { ConveyorSim, DEFAULT_CONFIG } from '../sim/conveyor';
import type { Color, SimEvent, SimState } from '../sim/types';
import { sfx } from './audio';
import {
  BOX,
  BUTTONS,
  COLOR_NAMES,
  COLORS,
  DEPTH,
  ENTRY_GATE_Y,
  EXTRA_HEIGHT,
  FONT,
  INK,
  INK_SOFT,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  MARBLE_SIZE,
  QUEUE,
  RENDER_SCALE,
  supplyX,
  TRACK,
  TRAY,
  TRAY_SLOTS,
} from './layout';
import { isCompleted, markCompleted } from './progress';
import { createTextures } from './textures';
import { trackPoint } from './track';

const INK_HEX = 0x2f3358;

const TICK_MS = 1000 / 60;
const IMPACT_MS = 130;
/** After a long stall, such as a backgrounded tab, resume instead of fast-forwarding through it. */
const MAX_FRAME_MS = 250;
/** Delivery sits at the start of the bottom straight, directly above the active box. A lap takes 2.4 seconds. */
const SIM_CONFIG = { ...DEFAULT_CONFIG, deliveryPosition: 14, ticksPerStep: 6 };
/** Where a poured marble drops into the funnel, and how far through its flight it gets there. */
const FUNNEL_MOUTH = { x: LOGICAL_WIDTH / 2, y: ENTRY_GATE_Y - 22, size: 44, split: 0.62 } as const;
const LANDING_GAP_MS = 70;
const BOX_CELEBRATE_MS = 170;
const BOX_SWAP_MS = 240;
const CHEVRON_COUNT = 24;
/** The gauge sits lower when there's no message below it. */
const GAUGE_IDLE_SHIFT = 42;

/** Marbles waiting to enter stay in their tray and pour out one at a time, so 'tray' covers pending too. */
type Place =
  | { readonly kind: 'tray'; readonly trayKey: number; readonly slot: number }
  | { readonly kind: 'belt'; readonly position: number }
  /** Delivered by the simulation, waiting in the chute until the active box can take it. */
  | { readonly kind: 'chute'; readonly index: number }
  | { readonly kind: 'box'; readonly box: number; readonly slot: number };

interface Blend {
  fromX: number;
  fromY: number;
  fromSize: number;
  elapsed: number;
  duration: number;
  arc: number;
  /** Fly here first, then continue to the target hidden under whatever is drawn above marbles. */
  via?: { readonly x: number; readonly y: number; readonly size: number };
  /** What this flight ends in, if its end should be heard and seen. */
  landing?: 'belt' | 'box';
}

interface MarbleView {
  readonly id: number;
  readonly color: Color;
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  size: number;
  placeKey: string;
  blend: Blend | null;
  /** Milliseconds left of the contact bounce and squash. */
  impact: number;
}

interface TrayView {
  readonly key: number;
  readonly supply: number;
  readonly image: Phaser.GameObjects.Image;
  /** 0 at the front of its supply, 1 behind it. */
  queueIndex: number;
  /** Horizontal offset used by the rejected-tap shake. Marbles follow it. */
  shake: { value: number };
}

interface BoxView {
  readonly index: number;
  readonly color: Color;
  readonly large: Phaser.GameObjects.Image;
  readonly mini: Phaser.GameObjects.Image;
  /** Which layout slot the box is tweening to: -1 gone, 0 front, 1+ in the queue. */
  slot: number;
}

interface Button {
  readonly container: Phaser.GameObjects.Container;
  readonly image: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  setEnabled(enabled: boolean): void;
}

export interface SceneData {
  readonly boardIndex?: number;
}

export class GameScene extends Phaser.Scene {
  sim!: ConveyorSim;
  boardIndex = 0;

  private accumulator = 0;
  private chevronPhase = 0;
  private chevrons: Phaser.GameObjects.Image[] = [];
  private marbles = new Map<number, MarbleView>();
  /** Where each marble started, which is also where it waits while pending. */
  private marbleHomes = new Map<number, { trayKey: number; slot: number }>();
  private trays = new Map<number, TrayView>();
  private boxes: BoxView[] = [];
  private delivered = new Map<number, { box: number; slot: number }>();
  /**
   * The simulation can deliver faster than boxes can be seen to fill and change, so the view keeps
   * its own pace. It never affects outcomes, only when they are shown.
   */
  private deliveryQueue: number[] = [];
  private visualFront = 0;
  private landedInFront = 0;
  private boxPhase: 'ready' | 'celebrating' | 'swapping' = 'ready';
  private boxPhaseTimer = 0;
  private landingGap = 0;
  private winPending = false;
  /** Marbles whose next move is a correction after undo or restart, not a real landing. */
  private silentMoves = new Set<number>();
  private gauge!: Phaser.GameObjects.Container;
  private pips: Phaser.GameObjects.Image[] = [];
  private occupancyText!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;
  private messageTimer: Phaser.Time.TimerEvent | null = null;
  private lamp!: Phaser.GameObjects.Image;
  private undoButton!: Button;
  private markChipDone: () => void = () => {};
  private arrow: Phaser.GameObjects.Image | null = null;
  private card: Phaser.GameObjects.Container | null = null;
  private jamExplained = false;
  private chain = 0;
  private chainTimer = 0;
  /** Guidance only ever applies to the first tap of the first attempt. */
  private guided = false;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastFrameAt = 0;
  /** Set by the capture script, which advances the game one frame at a time. */
  fixedStepping = false;

  constructor() {
    super('game');
  }

  init(data: SceneData): void {
    const firstOpen = BOARDS.findIndex((board) => !isCompleted(board.id));
    this.boardIndex = data.boardIndex ?? (firstOpen === -1 ? BOARDS.length - 1 : firstOpen);
    const board = BOARDS[this.boardIndex];
    if (!board) throw new Error(`No board at index ${this.boardIndex}`);
    this.sim = new ConveyorSim(board, SIM_CONFIG);
    this.accumulator = 0;
    this.lastFrameAt = performance.now();
    this.chevrons = [];
    this.marbleHomes = new Map();
    this.marbles = new Map();
    this.trays = new Map();
    this.boxes = [];
    this.delivered = new Map();
    this.deliveryQueue = [];
    this.visualFront = 0;
    this.landedInFront = 0;
    this.boxPhase = 'ready';
    this.boxPhaseTimer = 0;
    this.landingGap = 0;
    this.winPending = false;
    this.silentMoves = new Set();
    this.pips = [];
    this.arrow = null;
    this.card = null;
    this.jamExplained = false;
    this.chain = 0;
    this.messageTimer = null;
    this.guided = this.boardIndex === 0 && !isCompleted(board.id) && !GameScene.guideSeen;
  }

  private static guideSeen = false;

  create(): void {
    createTextures(this);
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);

    this.add
      .tileSprite(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_WIDTH, LOGICAL_HEIGHT + 2 * EXTRA_HEIGHT, 'dots')
      .setDepth(DEPTH.background);
    this.add
      .image(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 'track')
      .setDisplaySize(LOGICAL_WIDTH, LOGICAL_HEIGHT)
      .setDepth(DEPTH.track);

    for (let i = 0; i < CHEVRON_COUNT; i++) {
      this.chevrons.push(
        this.add.image(0, 0, 'chevron').setDisplaySize(20, 30).setAlpha(0.2).setDepth(DEPTH.chevrons),
      );
    }

    this.add.image(LOGICAL_WIDTH / 2, ENTRY_GATE_Y, 'entry-gate').setDisplaySize(110, 110).setDepth(DEPTH.gate);

    const delivery = trackPoint(SIM_CONFIG.deliveryPosition / SIM_CONFIG.beltPositions);
    this.add.image(delivery.x, delivery.y + 52, 'chute').setDisplaySize(130, 170).setDepth(DEPTH.gates);
    this.lamp = this.add
      .image(delivery.x, delivery.y + TRACK.bandHalf + 6, 'lamp')
      .setDisplaySize(26, 26)
      .setDepth(DEPTH.gate);

    this.createFx();
    this.createBoxes();
    this.createMarbles();
    this.syncTrays(true);
    this.createHud();
    this.createSupplyZones();
    this.updateBoxes(true);
    this.updateHud();
    if (this.guided) this.showGuide();

    this.input.once('pointerdown', () => sfx.unlock());
  }

  private createFx(): void {
    this.sparks = this.add
      .particles(0, 0, 'spark', {
        emitting: false,
        speed: { min: 70, max: 240 },
        lifespan: { min: 280, max: 560 },
        scale: { start: 0.5, end: 0 },
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(DEPTH.fx);
    this.confetti = this.add
      .particles(LOGICAL_WIDTH / 2, -40, 'confetti', {
        emitting: false,
        x: { min: -LOGICAL_WIDTH / 2, max: LOGICAL_WIDTH / 2 },
        speedY: { min: 240, max: 620 },
        speedX: { min: -90, max: 90 },
        rotate: { start: 0, end: 720 },
        lifespan: 2800,
        gravityY: 180,
        tint: [COLORS.red.hex, COLORS.blue.hex, COLORS.green.hex, COLORS.yellow.hex, 0xffffff],
        scale: { min: 0.7, max: 1.3 },
      })
      .setDepth(DEPTH.fx);
  }

  private createBoxes(): void {
    this.sim.board.boxes.forEach((color, index) => {
      const large = this.add
        .image(0, BOX.frontY, `box-${color}`)
        .setDisplaySize(BOX.width + 24, BOX.height + 32)
        .setDepth(DEPTH.box);
      const mini = this.add.image(0, QUEUE.y, `mini-${color}`).setDepth(DEPTH.box);
      this.boxes.push({ index, color, large, mini, slot: Number.NaN });
    });

    const label = this.add
      .text(QUEUE.leftX, QUEUE.y - 68, 'NEXT BOXES', { fontFamily: FONT, fontSize: '22px', fontStyle: '600', color: INK_SOFT })
      .setDepth(DEPTH.hud);
    label.setResolution(3);
  }

  private createMarbles(): void {
    for (const queue of this.sim.state.supplies) {
      for (const packet of queue) {
        const trayKey = packet.marbles[0]?.id ?? -1;
        for (const [slot, marble] of packet.marbles.entries()) {
          this.marbleHomes.set(marble.id, { trayKey, slot });
          const sprite = this.add.image(0, 0, `marble-${marble.color}`).setDepth(DEPTH.marble);
          const shadow = this.add.image(0, 0, 'shadow').setDepth(DEPTH.shadow).setAlpha(0.85);
          this.marbles.set(marble.id, {
            id: marble.id,
            color: marble.color,
            sprite,
            shadow,
            x: 0,
            y: 0,
            size: MARBLE_SIZE.tray,
            placeKey: '',
            blend: null,
            impact: 0,
          });
        }
      }
    }
  }

  // ---- HUD ----

  private text(x: number, y: number, value: string, size: number, color = INK, weight = '600'): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, value, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: weight, color });
    text.setResolution(3).setDepth(DEPTH.hud);
    return text;
  }

  private createHud(): void {
    const headerY = 50 - EXTRA_HEIGHT * 0.5;
    this.text(28, headerY - 24, 'Tumbleworks', 40, INK);

    BOARDS.forEach((board, index) => {
      const x = 484 + index * 66;
      const active = index === this.boardIndex;
      const foreground = active ? 0xffffff : INK_HEX;
      const chip = this.add.image(x, headerY, 'chip').setDisplaySize(72, 72).setDepth(DEPTH.hud);
      chip.setTint(active ? INK_HEX : 0xffffff);
      const previous = BOARDS[index - 1];
      const locked = previous !== undefined && !isCompleted(previous.id) && !active;
      if (locked) chip.setAlpha(0.5);
      const label = this.text(x, headerY - 2, String(index + 1), 28, active ? '#ffffff' : INK).setOrigin(0.5);
      if (locked) label.setAlpha(0.5);
      const check = this.add.image(x, headerY - 1, 'icon-check').setDisplaySize(30, 30).setTint(foreground).setDepth(DEPTH.hud);
      const showDone = (done: boolean): void => {
        label.setVisible(!done);
        check.setVisible(done);
      };
      showDone(isCompleted(board.id));
      if (index === this.boardIndex) this.markChipDone = () => showDone(true);
      chip.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (index !== this.boardIndex && !locked) this.scene.restart({ boardIndex: index });
      });
    });

    const mute = this.add.image(668, headerY, 'chip').setDisplaySize(72, 72).setDepth(DEPTH.hud);
    const muteIcon = this.add
      .image(668, headerY - 2, sfx.isMuted ? 'icon-muted' : 'icon-sound')
      .setDisplaySize(36, 36)
      .setTint(INK_HEX)
      .setDepth(DEPTH.hud);
    mute.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      sfx.unlock();
      muteIcon.setTexture(sfx.toggleMute() ? 'icon-muted' : 'icon-sound');
    });

    const { cx, cy } = TRACK;
    const gaugeLabel = this.text(cx, cy - 104, 'BELT LOAD', 22, INK_SOFT).setOrigin(0.5);
    this.occupancyText = this.text(cx, cy - 64, '', 46, INK).setOrigin(0.5);

    const capacity = this.sim.board.beltCapacity;
    const pipSpacing = 30;
    for (let i = 0; i < capacity; i++) {
      const x = cx + (i - (capacity - 1) / 2) * pipSpacing;
      this.pips.push(this.add.image(x, cy - 18, 'pip').setDisplaySize(24, 24));
    }
    this.gauge = this.add
      .container(0, GAUGE_IDLE_SHIFT, [gaugeLabel, this.occupancyText, ...this.pips])
      .setDepth(DEPTH.hud);

    this.message = this.text(cx, cy + 58, '', 28, INK, '500')
      .setOrigin(0.5)
      .setAlign('center')
      .setWordWrapWidth(410)
      .setLineSpacing(4);

    const buttonY = BUTTONS.y + EXTRA_HEIGHT * 0.5;
    this.undoButton = this.createButton(BUTTONS.undoX, buttonY, 'Undo', () => this.onUndo(), { icon: 'icon-undo' });
    this.createButton(BUTTONS.restartX, buttonY, 'Restart', () => this.onRestart(), { icon: 'icon-restart' });
  }

  private createButton(
    x: number,
    y: number,
    value: string,
    onTap: () => void,
    { primary = false, icon }: { primary?: boolean; icon?: string } = {},
  ): Button {
    const image = this.add.image(0, 0, primary ? 'button-primary' : 'button');
    if (primary) image.setDisplaySize(380, 112);
    else image.setDisplaySize(320, 104);
    const label = this.add
      .text(0, -6, value, {
        fontFamily: FONT,
        fontSize: '34px',
        fontStyle: '600',
        color: primary ? '#ffffff' : INK,
      })
      .setResolution(3)
      .setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [image, label];
    if (icon) {
      label.setX(20);
      parts.push(this.add.image(-label.width / 2 - 14, -6, icon).setDisplaySize(40, 40).setTint(INK_HEX));
    }
    const container = this.add.container(x, y, parts).setDepth(primary ? DEPTH.card + 1 : DEPTH.hud);
    let enabled = true;
    image
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (enabled) container.setScale(0.96);
      })
      .on('pointerout', () => container.setScale(1))
      .on('pointerup', () => {
        container.setScale(1);
        if (enabled) onTap();
      });
    return {
      container,
      image,
      label,
      setEnabled: (value2) => {
        enabled = value2;
        container.setAlpha(value2 ? 1 : 0.45);
      },
    };
  }

  private createSupplyZones(): void {
    const count = this.sim.board.supplies.length;
    for (let supply = 0; supply < count; supply++) {
      const zone = this.add
        .zone(supplyX(supply, count), TRAY.frontY - 60, TRAY.width + 24, TRAY.height + 150)
        .setDepth(DEPTH.hud);
      zone.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onSupplyTap(supply));
    }
  }

  private updateHud(): void {
    const { state, board } = this.sim;
    const occupancy = this.sim.occupancy;
    this.occupancyText.setText(`${occupancy} / ${board.beltCapacity}`);
    // A full belt that's draining is healthy, so only a jam gets the alarm colour.
    const filled = state.status === 'jammed' ? 0xf25f33 : INK_HEX;
    this.pips.forEach((pip, i) => {
      pip.setTint(i < occupancy ? filled : 0xdccbaf);
    });
    this.undoButton.setEnabled(this.sim.canUndo && state.status !== 'won');
    const color = this.sim.frontColor;
    if (color) {
      this.lamp.setVisible(true).setTint(COLORS[color].hex);
    } else {
      this.lamp.setVisible(false);
    }
  }

  private setMessage(value: string, holdMs = 0, color = INK): void {
    this.messageTimer?.remove();
    this.messageTimer = null;
    this.message.setText(value).setColor(color);
    this.tweens.killTweensOf(this.gauge);
    this.tweens.add({ targets: this.gauge, y: value ? 0 : GAUGE_IDLE_SHIFT, duration: 180, ease: 'Sine.easeOut' });
    if (holdMs > 0) {
      this.messageTimer = this.time.delayedCall(holdMs, () => this.setMessage(''));
    }
  }

  // ---- Input ----

  private onSupplyTap(supply: number): void {
    sfx.unlock();
    if (this.sim.state.status !== 'playing') return;

    if (this.guided && supply !== 0) {
      this.shakeFront(supply);
      sfx.tap();
      if (this.arrow) this.tweens.add({ targets: this.arrow, scale: this.arrow.scale * 1.25, duration: 120, yoyo: true });
      return;
    }

    const result = this.sim.release(supply);
    if (!result.ok) {
      if (result.reason === 'no-space') {
        if (result.canDrain) {
          // Not a mistake: the belt is about to make room, so don't sound the alarm.
          this.shakeFront(supply, 3);
          sfx.tap();
          this.setMessage(`Needs ${result.needed} free spaces.\nThe belt is clearing.`, 1600);
        } else {
          this.shakeFront(supply);
          sfx.blocked();
          this.vibrate(30);
          this.flashPips();
          this.setMessage(`Needs ${result.needed} free spaces`, 1800, '#c23a1a');
        }
      } else if (result.reason === 'empty') {
        sfx.tap();
      }
      return;
    }

    sfx.release();
    this.vibrate(12);
    if (this.guided) {
      this.guided = false;
      GameScene.guideSeen = true;
      this.arrow?.destroy();
      this.arrow = null;
      this.setMessage(`${COLOR_NAMES[result.color]} keeps riding\nuntil a ${result.color} box is ready.`);
    } else {
      this.setMessage('');
    }
    this.syncTrays();
    this.handleEvents(result.events);
    this.updateHud();
  }

  private onUndo(): void {
    if (!this.sim.undo()) return;
    sfx.unlock();
    sfx.undo();
    this.jamExplained = false;
    this.closeCard();
    this.setMessage('');
    this.chain = 0;
    const live = new Set(this.collectSimPlaces(this.sim.state).keys());
    for (const id of [...this.delivered.keys()]) {
      if (live.has(id)) this.delivered.delete(id);
    }
    this.resyncDeliveries();
    this.syncTrays();
    this.updateBoxes();
    this.updateHud();
  }

  private onRestart(): void {
    sfx.unlock();
    sfx.undo();
    this.sim.reset();
    this.delivered.clear();
    this.jamExplained = false;
    this.chain = 0;
    this.closeCard();
    this.setMessage('');
    this.resyncDeliveries();
    this.syncTrays();
    this.updateBoxes();
    this.updateHud();
  }

  /** Undo and restart jump the view straight to the simulation's state. */
  private resyncDeliveries(): void {
    for (const id of this.deliveryQueue) this.silentMoves.add(id);
    for (const view of this.marbles.values()) {
      if (view.blend) view.blend.landing = undefined;
    }
    this.deliveryQueue = [];
    this.visualFront = this.sim.state.frontBox;
    this.landedInFront = this.sim.state.frontBoxFill;
    this.boxPhase = 'ready';
    this.winPending = false;
  }

  private vibrate(ms: number): void {
    if ('vibrate' in navigator) navigator.vibrate(ms);
  }

  private shakeFront(supply: number, amount = 9): void {
    const key = this.sim.state.supplies[supply]?.[0]?.marbles[0]?.id;
    const tray = key === undefined ? undefined : this.trays.get(key);
    if (!tray) return;
    this.tweens.killTweensOf(tray.shake);
    tray.shake.value = 0;
    this.tweens.add({
      targets: tray.shake,
      value: { from: -amount, to: amount },
      duration: 50,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        tray.shake.value = 0;
      },
    });
  }

  private flashPips(): void {
    for (const pip of this.pips) {
      this.tweens.add({ targets: pip, scale: pip.scale * 1.3, duration: 90, yoyo: true });
    }
  }

  private showGuide(): void {
    const front = this.sim.state.supplies[0]?.[0];
    if (!front) return;
    this.setMessage(`Tap ${COLOR_NAMES[front.color].toLowerCase()} to release it\nand uncover what's underneath.`);
    const x = supplyX(0, this.sim.board.supplies.length);
    const restX = x + TRAY.width / 2 + 52;
    this.arrow = this.add
      .image(restX, TRAY.frontY - 2, 'arrow')
      .setDisplaySize(64, 78)
      .setAngle(90)
      .setDepth(DEPTH.fx);
    this.tweens.add({
      targets: this.arrow,
      x: restX + 18,
      duration: 460,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  // ---- Frame ----

  override update(_time: number, stepDelta: number): void {
    // Phaser smooths its delta, which turns a low frame rate into slow motion. The game should
    // always run in real time, so it keeps its own clock unless capture is stepping frames.
    const now = performance.now();
    const realDelta = Math.min(now - this.lastFrameAt, MAX_FRAME_MS);
    this.lastFrameAt = now;
    const delta = this.fixedStepping ? stepDelta : realDelta;

    this.accumulator += delta;
    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS;
      this.handleEvents(this.sim.tick());
    }

    this.chainTimer -= delta;
    if (this.chainTimer <= 0) this.chain = 0;
    this.runDeliveries(delta);

    const { state } = this.sim;
    const beltU = (position: number): number => {
      const fraction = (state.stepTick + this.accumulator / TICK_MS) / this.sim.config.ticksPerStep;
      return (position + fraction) / this.sim.config.beltPositions;
    };

    const lapTicks = this.sim.config.ticksPerStep * this.sim.config.beltPositions;
    this.chevronPhase = (this.chevronPhase + delta / TICK_MS / lapTicks) % 1;
    this.chevrons.forEach((chevron, i) => {
      const p = trackPoint(i / CHEVRON_COUNT + this.chevronPhase);
      chevron.setPosition(p.x, p.y).setRotation(p.angle);
    });

    const places = this.collectPlaces(state);
    for (const view of this.marbles.values()) {
      const place = places.get(view.id);
      if (place) this.driveMarble(view, place, beltU, delta);
    }
  }

  private collectPlaces(state: Readonly<SimState>): Map<number, Place> {
    const places = this.collectSimPlaces(state);
    for (const [id, target] of this.delivered) {
      if (places.has(id)) continue;
      const index = this.deliveryQueue.indexOf(id);
      places.set(id, index >= 0 ? { kind: 'chute', index } : { kind: 'box', box: target.box, slot: target.slot });
    }
    return places;
  }

  /** Every marble the simulation still holds, which is all but the delivered ones. */
  private collectSimPlaces(state: Readonly<SimState>): Map<number, Place> {
    const places = new Map<number, Place>();
    for (const queue of state.supplies) {
      for (const packet of queue) {
        const trayKey = packet.marbles[0]?.id ?? -1;
        packet.marbles.forEach((marble, slot) => places.set(marble.id, { kind: 'tray', trayKey, slot }));
      }
    }
    for (const marble of state.pending) {
      const home = this.marbleHomes.get(marble.id);
      if (home) places.set(marble.id, { kind: 'tray', ...home });
    }
    for (const marble of state.belt) places.set(marble.id, { kind: 'belt', position: marble.position });
    return places;
  }

  private driveMarble(view: MarbleView, place: Place, beltU: (position: number) => number, delta: number): void {
    const target = this.placeTarget(place, beltU);
    const key = place.kind === 'belt' ? 'belt' : `${place.kind}:${JSON.stringify(place)}`;

    if (view.placeKey !== key) {
      const first = view.placeKey === '';
      const previous = view.placeKey.split(':')[0] ?? '';
      view.placeKey = key;
      if (first) {
        view.x = target.x;
        view.y = target.y;
        view.size = target.size;
      } else {
        view.blend = { fromX: view.x, fromY: view.y, fromSize: view.size, elapsed: 0, ...this.motionFor(previous, place.kind) };
        if (this.silentMoves.delete(view.id)) view.blend.landing = undefined;
      }
    }

    let lift = 0;
    let hidden = false;
    if (view.blend) {
      const blend = view.blend;
      blend.elapsed += delta;
      const t = Math.min(blend.elapsed / blend.duration, 1);
      if (blend.via) {
        const { via } = blend;
        if (t < FUNNEL_MOUTH.split) {
          const k = t / FUNNEL_MOUTH.split;
          const eased = k * k * (3 - 2 * k);
          view.x = blend.fromX + (via.x - blend.fromX) * eased;
          view.y = blend.fromY + (via.y - blend.fromY) * eased;
          view.size = blend.fromSize + (via.size - blend.fromSize) * eased;
          lift = Math.sin(k * Math.PI) * blend.arc;
        } else {
          const k = (t - FUNNEL_MOUTH.split) / (1 - FUNNEL_MOUTH.split);
          view.x = via.x + (target.x - via.x) * k;
          view.y = via.y + (target.y - via.y) * k;
          view.size = via.size + (target.size - via.size) * k;
          hidden = true;
        }
      } else {
        const eased = t * t * (3 - 2 * t);
        view.x = blend.fromX + (target.x - blend.fromX) * eased;
        view.y = blend.fromY + (target.y - blend.fromY) * eased;
        view.size = blend.fromSize + (target.size - blend.fromSize) * eased;
        lift = Math.sin(t * Math.PI) * blend.arc;
      }
      if (t >= 1) {
        view.blend = null;
        if (blend.landing) {
          view.impact = IMPACT_MS;
          if (blend.landing === 'belt') sfx.enter();
          else if (place.kind === 'box') this.onLanded(place);
        }
      }
    } else {
      view.x = target.x;
      view.y = target.y;
      view.size = target.size;
    }

    let stretchX = 1;
    let stretchY = 1;
    if (view.impact > 0) {
      view.impact = Math.max(view.impact - delta, 0);
      const k = Math.sin((1 - view.impact / IMPACT_MS) * Math.PI);
      lift += k * 5;
      stretchX = 1 + k * 0.1;
      stretchY = 1 - k * 0.12;
    }

    const size = view.size + lift * 0.14;
    view.sprite.setPosition(view.x, view.y - lift).setDisplaySize(size * stretchX, size * stretchY);
    view.sprite.setDepth(lift > 8 ? DEPTH.flying : DEPTH.marble);
    const seated = place.kind === 'tray' && lift < 2;
    view.shadow
      .setPosition(view.x + 3 + lift * 0.1, view.y + 6 + lift * 0.3)
      .setDisplaySize(view.size * 1.28, view.size * 1.28)
      .setAlpha(seated || hidden ? 0 : 0.85 * (1 - Math.min(lift / 180, 0.6)));
    const visible = place.kind !== 'box' || this.boxVisible(place.box);
    view.sprite.setVisible(visible);
    view.shadow.setVisible(visible && place.kind !== 'box');
  }

  private motionFor(from: string, to: Place['kind']): Pick<Blend, 'duration' | 'arc' | 'via' | 'landing'> {
    if (to === 'belt') {
      if (from !== 'tray') return { duration: 300, arc: 34 };
      return { duration: 380, arc: 74, via: FUNNEL_MOUTH, landing: 'belt' };
    }
    if (to === 'chute') return from === 'chute' ? { duration: 70, arc: 0 } : { duration: 110, arc: 4 };
    if (to === 'box') return { duration: 190, arc: 26, landing: 'box' };
    return { duration: 320, arc: 40 };
  }

  private placeTarget(place: Place, beltU: (position: number) => number): { x: number; y: number; size: number } {
    switch (place.kind) {
      case 'tray': {
        const tray = this.trays.get(place.trayKey);
        const slot = TRAY_SLOTS[place.slot] ?? TRAY_SLOTS[0];
        if (!tray) return { x: 0, y: 0, size: MARBLE_SIZE.tray };
        const scale = tray.image.displayWidth / (TRAY.width + 20);
        return {
          x: tray.image.x + tray.shake.value + slot.x * scale,
          y: tray.image.y + (slot.y - 6) * scale,
          size: MARBLE_SIZE.tray * scale,
        };
      }
      case 'belt': {
        const p = trackPoint(beltU(place.position));
        return { x: p.x, y: p.y, size: MARBLE_SIZE.belt };
      }
      case 'chute': {
        const gate = trackPoint(SIM_CONFIG.deliveryPosition / SIM_CONFIG.beltPositions);
        return { x: gate.x, y: gate.y + 62 - Math.min(place.index, 5) * 11, size: MARBLE_SIZE.tray };
      }
      case 'box': {
        const box = this.boxes[place.box];
        if (!box) return { x: 0, y: 0, size: MARBLE_SIZE.box };
        const scale = box.large.displayWidth / (BOX.width + 24);
        return {
          x: box.large.x + (place.slot - 1) * BOX.slotSpacing * scale,
          y: box.large.y - 8 * scale,
          size: MARBLE_SIZE.box * scale,
        };
      }
    }
  }

  private boxVisible(index: number): boolean {
    return this.boxes[index]?.large.visible ?? false;
  }

  // ---- State to view ----

  private syncTrays(initial = false): void {
    const { state, board } = this.sim;

    // A released tray stays put until its last marble has poured out.
    const pouring = new Set<number>();
    for (const marble of state.pending) {
      const home = this.marbleHomes.get(marble.id);
      if (home) pouring.add(home.trayKey);
    }

    const seen = new Set(pouring);
    state.supplies.forEach((queue, supply) => {
      const frontBusy = [...this.trays.values()].some(
        (tray) => tray.supply === supply && tray.queueIndex === 0 && pouring.has(tray.key),
      );
      queue.forEach((packet, position) => {
        const key = packet.marbles[0]?.id;
        if (key === undefined) return;
        seen.add(key);
        const queueIndex = position === 0 && !frontBusy ? 0 : 1;
        const x = supplyX(supply, board.supplies.length);
        const y = queueIndex === 0 ? TRAY.frontY : TRAY.nextY;
        const scale = queueIndex === 0 ? 1 : TRAY.nextScale;
        const width = (TRAY.width + 20) * scale;
        const height = (TRAY.height + 28) * scale;
        let tray = this.trays.get(key);
        if (!tray) {
          const image = this.add
            .image(x, y, `tray-${packet.color}`)
            .setDisplaySize(width, height)
            .setDepth(DEPTH.tray - queueIndex);
          tray = { key, supply, image, queueIndex, shake: { value: 0 } };
          this.trays.set(key, tray);
          if (!initial) {
            image.setAlpha(0);
            this.tweens.add({ targets: image, alpha: 1, duration: 200 });
          }
        } else if (tray.queueIndex !== queueIndex) {
          tray.queueIndex = queueIndex;
          tray.image.setDepth(DEPTH.tray - queueIndex);
          this.tweens.add({
            targets: tray.image,
            y,
            displayWidth: width,
            displayHeight: height,
            duration: 240,
            ease: 'Back.easeOut',
          });
        }
      });
    });

    for (const [key, tray] of this.trays) {
      if (seen.has(key)) continue;
      this.trays.delete(key);
      this.tweens.add({
        targets: tray.image,
        y: tray.image.y - 26,
        alpha: 0,
        duration: 220,
        ease: 'Sine.easeIn',
        onComplete: () => tray.image.destroy(),
      });
    }
  }

  private updateBoxes(instant = false): void {
    const frontBox = this.visualFront;
    const delivery = trackPoint(SIM_CONFIG.deliveryPosition / SIM_CONFIG.beltPositions);

    for (const box of this.boxes) {
      const slot = box.index < frontBox ? -1 : box.index - frontBox;
      const changed = box.slot !== slot;
      const wasFront = box.slot === 0;
      box.slot = slot;
      this.tweens.killTweensOf(box.large);
      this.tweens.killTweensOf(box.mini);

      if (slot > 0) {
        const column = (slot - 1) % QUEUE.perRow;
        const row = Math.floor((slot - 1) / QUEUE.perRow);
        const x = QUEUE.leftX + QUEUE.size / 2 + column * (QUEUE.size + QUEUE.gap);
        const y = QUEUE.y + row * QUEUE.rowGap;
        const size = QUEUE.size * 1.08;
        box.large.setVisible(false);
        box.mini.setVisible(true);
        if (instant) box.mini.setPosition(x, y).setDisplaySize(size, size * (80 / 76));
        else
          this.tweens.add({
            targets: box.mini,
            x,
            y,
            displayWidth: size,
            displayHeight: size * (80 / 76),
            duration: 260,
            ease: 'Back.easeOut',
          });
      } else if (slot === 0) {
        box.large.setVisible(true);
        box.large.setAlpha(1);
        if (instant || !changed) {
          box.mini.setVisible(false);
          box.large.setPosition(delivery.x, BOX.frontY).setDisplaySize(BOX.width + 24, BOX.height + 32).setRotation(0);
        } else {
          // Grow out of the queue into the delivery position.
          const fromX = box.mini.visible ? box.mini.x : delivery.x;
          box.mini.setVisible(false);
          box.large.setPosition(fromX, box.mini.y).setDisplaySize(90, 56).setRotation(0);
          this.tweens.add({
            targets: box.large,
            x: delivery.x,
            y: BOX.frontY,
            displayWidth: BOX.width + 24,
            displayHeight: BOX.height + 32,
            duration: BOX_SWAP_MS,
            ease: 'Cubic.easeOut',
          });
        }
      } else {
        box.mini.setVisible(false);
        if (instant) {
          box.large.setVisible(false);
        } else if (changed && wasFront) {
          // Leaves as the next box arrives, moving the same way, so the two never overlap.
          box.large.setVisible(true);
          this.tweens.add({
            targets: box.large,
            x: -170,
            rotation: -0.2,
            duration: BOX_SWAP_MS,
            ease: 'Cubic.easeIn',
            onComplete: () => box.large.setVisible(false),
          });
        } else {
          box.large.setVisible(false);
        }
      }
    }
  }

  // ---- Simulation events ----

  private handleEvents(events: readonly SimEvent[]): void {
    let dirty = false;
    for (const event of events) {
      dirty = true;
      switch (event.type) {
        case 'entered':
          this.syncTrays();
          break;
        case 'delivered':
          this.delivered.set(event.marbleId, { box: event.boxIndex, slot: event.slot });
          this.deliveryQueue.push(event.marbleId);
          break;
        case 'boxFilled':
          // Shown when its third marble lands, in onLanded.
          break;
        case 'won':
          markCompleted(this.sim.board.id);
          this.markChipDone();
          this.winPending = true;
          break;
        case 'jammed':
          sfx.jam();
          this.vibrate(60);
          break;
      }
    }
    if (dirty) this.updateHud();
    if (this.sim.state.status === 'jammed' && !this.jamExplained && this.sim.state.pending.length === 0) {
      this.jamExplained = true;
      this.showJamCard();
    }
  }

  /** Lets one waiting marble drop per gap, and moves boxes on once they've been seen to fill. */
  private runDeliveries(delta: number): void {
    if (this.boxPhase !== 'ready') {
      this.boxPhaseTimer -= delta;
      if (this.boxPhaseTimer > 0) return;
      if (this.boxPhase === 'celebrating') {
        this.visualFront += 1;
        this.updateBoxes();
        this.boxPhase = 'swapping';
        this.boxPhaseTimer = BOX_SWAP_MS;
        return;
      }
      this.boxPhase = 'ready';
      this.landingGap = 0;
    }

    this.landingGap -= delta;
    const head = this.deliveryQueue[0];
    if (head !== undefined && this.landingGap <= 0 && this.delivered.get(head)?.box === this.visualFront) {
      this.deliveryQueue.shift();
      this.landingGap = LANDING_GAP_MS;
    }

    if (this.winPending && this.deliveryQueue.length === 0 && this.visualFront >= this.boxes.length) {
      this.winPending = false;
      this.celebrateWin();
    }
  }

  private onLanded(place: Extract<Place, { kind: 'box' }>): void {
    sfx.deliver(place.slot);
    const box = this.boxes[place.box];
    if (box) this.tweens.add({ targets: box.large, y: BOX.frontY + 3, duration: 55, yoyo: true, ease: 'Sine.easeOut' });

    this.landedInFront += 1;
    if (this.landedInFront < this.sim.board.boxSize) return;
    this.landedInFront = 0;
    this.chain += 1;
    this.chainTimer = 1800;
    sfx.boxFilled(this.chain - 1);
    this.vibrate(18);
    this.boxPhase = 'celebrating';
    this.boxPhaseTimer = BOX_CELEBRATE_MS;
    if (box) {
      this.sparks.setParticleTint(COLORS[box.color].hex);
      this.sparks.explode(18, box.large.x, box.large.y);
      this.tweens.add({
        targets: box.large,
        displayWidth: (BOX.width + 24) * 1.07,
        displayHeight: (BOX.height + 32) * 1.07,
        duration: BOX_CELEBRATE_MS / 2,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    }
  }

  private jamReason(): string {
    const { state } = this.sim;
    const color = this.sim.frontColor;
    if (!color) return 'Nothing left can move.';
    const name = COLOR_NAMES[color];
    const exposed = state.supplies.some((queue) => queue[0]?.color === color);
    if (exposed) return `The next box needs ${name.toLowerCase()}, but there's no room left on the belt to release it.`;
    return `The next box needs ${name.toLowerCase()}, but it's stuck under another packet, with no room to move that packet.`;
  }

  private showJamCard(): void {
    this.setMessage('');
    const { cx, cy } = TRACK;
    const bg = this.add.image(0, 0, 'card').setDisplaySize(480, 310);
    const title = this.add
      .text(0, -92, 'Belt jammed!', { fontFamily: FONT, fontSize: '44px', fontStyle: '600', color: '#c23a1a' })
      .setResolution(3)
      .setOrigin(0.5);
    const body = this.add
      .text(0, 2, this.jamReason(), {
        fontFamily: FONT,
        fontSize: '28px',
        fontStyle: '500',
        color: INK,
        align: 'center',
        wordWrap: { width: 410 },
        lineSpacing: 4,
      })
      .setResolution(3)
      .setOrigin(0.5);
    this.openCard(cx, cy, [bg, title, body]);

    // Point at Undo. It has been usable since the moment the jam happened.
    this.tweens.add({
      targets: this.undoButton.container,
      scale: 1.07,
      duration: 340,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private celebrateWin(): void {
    sfx.win();
    this.vibrate(40);
    this.time.delayedCall(420, () => this.showWinCard());
    this.confetti.explode(120);
    this.time.delayedCall(300, () => this.confetti.explode(100));
  }

  private showWinCard(): void {
    if (this.sim.state.status !== 'won') return;
    const { cx, cy } = TRACK;
    const hasNext = this.boardIndex + 1 < BOARDS.length;
    const bg = this.add.image(0, 0, 'card').setDisplaySize(480, 310);
    const title = this.add
      .text(0, -92, hasNext ? 'Machine clear!' : 'All clear!', { fontFamily: FONT, fontSize: '44px', fontStyle: '600', color: INK })
      .setResolution(3)
      .setOrigin(0.5);
    const body = this.add
      .text(0, -30, hasNext ? 'Every box filled.' : "That's the whole demo so far.", {
        fontFamily: FONT,
        fontSize: '28px',
        fontStyle: '500',
        color: INK_SOFT,
      })
      .setResolution(3)
      .setOrigin(0.5);
    const button = this.createButton(
      0,
      62,
      hasNext ? 'Next level' : 'Play again',
      () => this.scene.restart({ boardIndex: hasNext ? this.boardIndex + 1 : 0 }),
      { primary: true },
    );
    this.openCard(cx, cy, [bg, title, body, button.container]);
  }

  private openCard(x: number, y: number, children: Phaser.GameObjects.GameObject[]): void {
    this.closeCard();
    const container = this.add.container(x, y, children).setDepth(DEPTH.card).setScale(0.82).setAlpha(0);
    this.card = container;
    this.tweens.add({ targets: container, scale: 1, alpha: 1, duration: 240, ease: 'Back.easeOut' });
  }

  private closeCard(): void {
    this.tweens.killTweensOf(this.undoButton.container);
    this.undoButton.container.setScale(1);
    this.card?.destroy();
    this.card = null;
  }

  // ---- Test and capture hooks ----

  /** Positions in page CSS pixels, so a browser test can tap what a player would. */
  debugTargets(): Record<string, { x: number; y: number }> {
    const canvas = this.game.canvas.getBoundingClientRect();
    const toPage = (x: number, y: number): { x: number; y: number } => ({
      x: canvas.left + (x / LOGICAL_WIDTH) * canvas.width,
      y: canvas.top + ((y + EXTRA_HEIGHT) / (LOGICAL_HEIGHT + 2 * EXTRA_HEIGHT)) * canvas.height,
    });
    const targets: Record<string, { x: number; y: number }> = {
      undo: toPage(BUTTONS.undoX, BUTTONS.y + EXTRA_HEIGHT * 0.5),
      restart: toPage(BUTTONS.restartX, BUTTONS.y + EXTRA_HEIGHT * 0.5),
      card: toPage(TRACK.cx, TRACK.cy + 62),
    };
    BOARDS.forEach((_, i) => {
      targets[`chip${i}`] = toPage(484 + i * 66, 50 - EXTRA_HEIGHT * 0.5);
    });
    const count = this.sim.board.supplies.length;
    for (let i = 0; i < count; i++) targets[`supply${i}`] = toPage(supplyX(i, count), TRAY.frontY);
    return targets;
  }
}

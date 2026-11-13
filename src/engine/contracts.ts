import type { Color } from '../sim/types';
import type { Replayable } from './replay';
import type { PhysicsService } from './physics';
import type { Stage } from './stage';

export type GameStatus = 'playing' | 'won' | 'jammed';
export type Difficulty = 'Getting started' | 'Finding a rhythm' | 'Thinking ahead' | 'Full spectrum';
export interface ScreenPoint { x: number; y: number; label?: string }
export interface GuideStep { readonly text: string; readonly target?: string; readonly done?: boolean }
interface FeedbackDetails {
  readonly text?: string;
  readonly strength?: number;
  readonly slot?: number;
  readonly target?: string;
}
export type Feedback = FeedbackDetails & (
  { readonly type: 'tap' | 'move' | 'match' | 'blocked' | 'impact' | 'deliver' | 'message' }
  | { readonly type: 'landing'; readonly arrival: number }
);
export interface GameServices { readonly stage: Stage; readonly physics: PhysicsService }
export interface GameLevel {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly instructions: string;
  readonly create: (services: GameServices) => GameRuntime;
}

/** No gameplay-specific state or branch belongs in the campaign controller. */
export interface GameRuntime {
  readonly guideId?: string;
  guide?(): GuideStep;
  readonly drag?: {
    start(target: string, point: ScreenPoint): boolean;
    move(point: ScreenPoint, target: string | null): void;
    end(target: string | null): readonly Feedback[];
    cancel(): void;
  };
  /** The rule state underneath, recording every accepted action. */
  readonly game: Replayable;
  readonly status: GameStatus;
  readonly busy: boolean;
  /**
   * True when drawing again would show the same picture. The app then skips drawing until something
   * moves or the player acts. Leave it out when the board never rests, as a running belt doesn't.
   */
  readonly still?: boolean;
  readonly canUndo: boolean;
  readonly counter: { label: string; value: string; full?: boolean };
  readonly preview: readonly Color[];
  readonly previewLabel: string;
  readonly jamReason: string;
  activate(target: string): readonly Feedback[];
  pick(x: number, y: number): string | null;
  hint(): readonly Feedback[];
  undo(): boolean;
  step(): readonly Feedback[];
  render(alpha: number, seconds: number): void;
  /** The level has just been won: the board's own send-off, if it has one. */
  celebrate?(clean?: number): void;
  resize(): void;
  targets(): Record<string, ScreenPoint>;
  inspect(): Record<string, unknown>;
  dispose(): void;
}

export interface GameplayPack { readonly kind: string; readonly levels: readonly GameLevel[] }

export class CampaignRegistry {
  private readonly packs: GameplayPack[] = [];
  register(pack: GameplayPack): this {
    if (!pack.kind || this.packs.some((existing) => existing.kind === pack.kind)) throw new Error('Duplicate gameplay kind');
    const ids = new Set(this.packs.flatMap((existing) => existing.levels.map((level) => level.id)));
    for (const level of pack.levels) {
      if (!level.id || level.kind !== pack.kind || ids.has(level.id)) throw new Error('Invalid or duplicate campaign level');
      ids.add(level.id);
    }
    this.packs.push(pack);
    return this;
  }

  /** Interleave each pack's difficulty bank; uneven banks work without changing the engine. */
  levels(): readonly GameLevel[] {
    const result: GameLevel[] = [];
    const rounds = Math.max(0, ...this.packs.map((pack) => pack.levels.length));
    for (let round = 0; round < rounds; round++) {
      for (const pack of this.packs) {
        const level = pack.levels[round];
        if (level) result.push(level);
      }
    }
    return result;
  }
}

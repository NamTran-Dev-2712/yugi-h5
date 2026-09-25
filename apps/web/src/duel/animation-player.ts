import type { AnimationSegment, AnimationStep } from './animation-queue';
import type { DuelAnimator } from './duel-controller';

/**
 * Plays segments one step at a time. No Phaser: the scene supplies `onStep` (draw the effect) and `onSkip` (clear
 * the effects); time comes from an injected scheduler so tests use fake timers. `play()` always resolves — a
 * throwing `onStep` or a skip ends the run instead of leaving the caller waiting (the controller would stay locked).
 */

/** Runs `fn` after `ms`, returns a cancel function. */
export type Scheduler = (fn: () => void, ms: number) => () => void;

export const timerScheduler: Scheduler = (fn, ms) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export interface AnimationPlayerOptions {
  readonly schedule: Scheduler;
  readonly onStep: (step: AnimationStep) => void;
  /** Called when a running animation is cut short; the scene should clear whatever it drew. */
  readonly onSkip?: () => void;
  /** 1 = normal, 2 = twice as fast; `Infinity` = play nothing (tests, fast mode). */
  readonly speed?: number;
}

export interface AnimationPlayer {
  play(segments: readonly AnimationSegment[]): Promise<void>;
  skip(): void;
  setSpeed(speed: number): void;
  isPlaying(): boolean;
}

/**
 * `?anim=off` plays nothing, `?fast=1` plays 3× faster, otherwise 1. Only a convenience for quick play-testing and
 * e2e runs; the skip key (Space/Enter) works in every mode.
 */
export function animationSpeedFromSearch(search: string): number {
  const q = new URLSearchParams(search);
  if (q.get('anim') === 'off') return Infinity;
  if (q.get('fast') === '1') return 3;
  return 1;
}

/**
 * The controller is built before the scene exists and outlives it, so it gets this stable animator; the scene
 * attaches its player while it is on screen. Nothing attached (menu, tests) = nothing to play, resolves at once.
 */
export interface AnimatorHost {
  readonly animator: DuelAnimator;
  attach(player: AnimationPlayer | null): void;
}

export function createAnimatorHost(): AnimatorHost {
  let current: AnimationPlayer | null = null;
  return {
    animator: {
      play: (segments) => (current ? current.play(segments) : Promise.resolve()),
      skip: () => current?.skip(),
    },
    attach(player) {
      current?.skip();
      current = player;
    },
  };
}

export function createAnimationPlayer(options: AnimationPlayerOptions): AnimationPlayer {
  const { schedule, onStep, onSkip } = options;
  let speed = options.speed ?? 1;
  let finishRun: (() => void) | null = null;
  let cancelTimer: (() => void) | null = null;

  function skip(): void {
    if (!finishRun) return;
    cancelTimer?.();
    cancelTimer = null;
    const done = finishRun;
    finishRun = null;
    try {
      onSkip?.();
    } finally {
      done();
    }
  }

  function play(segments: readonly AnimationSegment[]): Promise<void> {
    skip(); // a new run finishes the old one first
    const steps = segments.flatMap((s) => s.steps);
    if (steps.length === 0 || speed === Infinity) return Promise.resolve();

    return new Promise<void>((resolve) => {
      let index = 0;
      const finish = (): void => {
        cancelTimer = null;
        if (finishRun === finish) finishRun = null;
        resolve();
      };
      finishRun = finish;

      const next = (): void => {
        const step = steps[index++];
        if (!step) {
          finish();
          return;
        }
        try {
          onStep(step);
        } catch {
          finish();
          return;
        }
        cancelTimer = schedule(next, step.durationMs / speed);
      };
      next();
    });
  }

  return {
    play,
    skip,
    setSpeed(value) {
      speed = value > 0 ? value : 1;
    },
    isPlaying: () => finishRun !== null,
  };
}

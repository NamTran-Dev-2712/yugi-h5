import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnimationSegment, AnimationStep } from './animation-queue';
import {
  animationSpeedFromSearch,
  createAnimationPlayer,
  createAnimatorHost,
  timerScheduler,
} from './animation-player';

const step = (
  kind: AnimationStep['kind'],
  durationMs: number,
  text: string = kind,
): AnimationStep => ({ kind, durationMs, text }) as AnimationStep;
const seg = (...steps: AnimationStep[]): AnimationSegment => ({ ai: false, steps });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(speed?: number) {
  const seen: string[] = [];
  const player = createAnimationPlayer({
    schedule: timerScheduler,
    onStep: (s) => seen.push(s.text),
    ...(speed === undefined ? {} : { speed }),
  });
  return { player, seen };
}

describe('speed from the URL and the animator host', () => {
  it('reads ?anim=off and ?fast=1, default 1', () => {
    expect(animationSpeedFromSearch('')).toBe(1);
    expect(animationSpeedFromSearch('?fast=1')).toBe(3);
    expect(animationSpeedFromSearch('?anim=off')).toBe(Infinity);
    expect(animationSpeedFromSearch('?fast=0')).toBe(1);
  });

  it('host: nothing attached resolves at once; attached delegates; detaching skips the old player', async () => {
    const host = createAnimatorHost();
    await host.animator.play([seg(step('summon', 400))]);
    const seen: string[] = [];
    const onSkip = vi.fn();
    const player = createAnimationPlayer({
      schedule: timerScheduler,
      onStep: (s) => seen.push(s.text),
      onSkip,
    });
    host.attach(player);
    const p = host.animator.play([seg(step('summon', 400, 'a'))]);
    expect(seen).toEqual(['a']);
    host.attach(null);
    await p;
    expect(onSkip).toHaveBeenCalled();
  });
});

describe('animation player', () => {
  it('plays steps in order, each for its duration, and resolves after the last one', async () => {
    const { player, seen } = setup();
    let done = false;
    void player
      .play([
        seg(step('summon', 400, 'a'), step('attack', 500, 'b')),
        seg(step('damage', 600, 'c')),
      ])
      .then(() => (done = true));
    expect(seen).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(399);
    expect(seen).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(1);
    expect(seen).toEqual(['a', 'b']);
    await vi.advanceTimersByTimeAsync(500);
    expect(seen).toEqual(['a', 'b', 'c']);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(599);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(player.isPlaying()).toBe(false);
  });

  it('reports isPlaying while running', async () => {
    const { player } = setup();
    const p = player.play([seg(step('summon', 100))]);
    expect(player.isPlaying()).toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    await p;
    expect(player.isPlaying()).toBe(false);
  });

  it('nothing to play → resolves without calling onStep', async () => {
    const { player, seen } = setup();
    await player.play([]);
    await player.play([seg()]);
    expect(seen).toEqual([]);
  });

  it('skip() resolves at once, stops later steps and tells the scene to clear', async () => {
    const seen: string[] = [];
    const onSkip = vi.fn();
    const player = createAnimationPlayer({
      schedule: timerScheduler,
      onStep: (s) => seen.push(s.text),
      onSkip,
    });
    let done = false;
    void player
      .play([seg(step('summon', 400, 'a'), step('attack', 500, 'b'))])
      .then(() => (done = true));
    player.skip();
    await Promise.resolve();
    expect(done).toBe(true);
    expect(onSkip).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(seen).toEqual(['a']);
    expect(player.isPlaying()).toBe(false);
  });

  it('skip() with nothing playing does nothing', () => {
    const onSkip = vi.fn();
    const player = createAnimationPlayer({ schedule: timerScheduler, onStep: () => {}, onSkip });
    player.skip();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('speed divides durations; Infinity plays nothing and resolves immediately', async () => {
    const fast = setup(2);
    void fast.player.play([seg(step('summon', 400, 'a'), step('attack', 400, 'b'))]);
    await vi.advanceTimersByTimeAsync(200);
    expect(fast.seen).toEqual(['a', 'b']);

    const instant = setup(Infinity);
    await instant.player.play([seg(step('summon', 400, 'a'))]);
    expect(instant.seen).toEqual([]);
  });

  it('setSpeed applies to the next step', async () => {
    const { player, seen } = setup();
    void player.play([
      seg(step('summon', 400, 'a'), step('attack', 400, 'b'), step('damage', 400, 'c')),
    ]);
    player.setSpeed(4);
    await vi.advanceTimersByTimeAsync(400);
    expect(seen).toEqual(['a', 'b']);
    await vi.advanceTimersByTimeAsync(100);
    expect(seen).toEqual(['a', 'b', 'c']);
  });

  it('a second play() while one is running finishes the first before starting', async () => {
    const { player, seen } = setup();
    let first = false;
    void player.play([seg(step('summon', 400, 'a'))]).then(() => (first = true));
    void player.play([seg(step('attack', 400, 'b'))]);
    await Promise.resolve();
    expect(first).toBe(true);
    expect(seen).toEqual(['a', 'b']);
  });

  it('an onStep that throws does not leave the promise hanging', async () => {
    const player = createAnimationPlayer({
      schedule: timerScheduler,
      onStep: () => {
        throw new Error('draw failed');
      },
    });
    await expect(player.play([seg(step('summon', 400))])).resolves.toBeUndefined();
    expect(player.isPlaying()).toBe(false);
  });
});

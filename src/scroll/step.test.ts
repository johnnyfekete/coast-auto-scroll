import { describe, it, expect } from 'vitest';
import {
  BOTTOM_STALL_MS,
  DRIFT_TOLERANCE_PX,
  MAX_STEP_MS,
  OVERRIDE_PAUSE_MS,
  initialState,
  step,
  type ScrollState,
} from './step';

const PAGE = { max: 10_000, speed: 100 };

/** A step nobody interfered with: the page is exactly where we last put it. */
function tick(state: ScrollState, now: number, elapsed: number, actual = state.position) {
  return step(state, { now, elapsed, actual, ...PAGE });
}

describe('moving the page', () => {
  it('advances by speed times elapsed time', () => {
    // 100 px/s for 100ms is 10px, arrived at from the definition rather than
    // from the implementation.
    const { scrollTo } = tick(initialState(0, 0), 0, 100);
    expect(scrollTo).toBe(10);
  });

  it('keeps fractions, so the slowest speeds still accumulate', () => {
    // At 4 px/s a 16ms frame is 0.064px. Rounded to whole pixels every frame
    // that would floor to zero forever and the page would never move at all.
    const slow = step(initialState(0, 0), { now: 0, elapsed: 16, actual: 0, max: 10_000, speed: 4 });
    expect(slow.scrollTo).toBeGreaterThan(0);
    expect(slow.scrollTo).toBeLessThan(1);
  });

  it('carries on from where the last step left it', () => {
    let state = initialState(0, 0);
    for (let frame = 0; frame < 10; frame++) {
      state = tick(state, frame * 100, 100).state;
    }
    expect(state.position).toBe(100);
  });
});

describe('somebody else scrolled', () => {
  it('stops moving the page when it is not where we left it', () => {
    const moved = tick(initialState(500, 0), 1000, 16, 500 + DRIFT_TOLERANCE_PX + 1);
    expect(moved.scrollTo).toBeNull();
  });

  it('adopts the position the reader chose, rather than pulling them back', () => {
    const moved = tick(initialState(500, 0), 1000, 16, 900);
    expect(moved.state.position).toBe(900);
  });

  it('resumes from the reader position once they have stopped', () => {
    const paused = tick(initialState(500, 0), 1000, 16, 900);
    const later = tick(paused.state, 1000 + OVERRIDE_PAUSE_MS + 1, 100);
    expect(later.scrollTo).toBe(910);
  });

  it('holds the pause open while the reader keeps scrolling', () => {
    // A wheel gesture arrives as a run of frames. The pause has to end after
    // the last of them, not after the first.
    let state = initialState(500, 0);
    let position = 500;
    for (let frame = 0; frame < 20; frame++) {
      position += 50;
      state = tick(state, frame * 30, 30, position).state;
    }
    const stillPaused = tick(state, 19 * 30 + 10, 16);
    expect(stillPaused.scrollTo).toBeNull();
  });

  it('ignores movement inside the tolerance, which is the page rounding rather than a reader', () => {
    // Browsers store the scroll offset at device-pixel resolution, so a
    // fractional target comes back rounded. Read as a reader scrolling, the
    // crawl would pause itself forever at the slowest speeds.
    const drifted = tick(initialState(500, 0), 1000, 100, 500 + DRIFT_TOLERANCE_PX - 0.5);
    expect(drifted.scrollTo).not.toBeNull();
  });
});

describe('clamping', () => {
  it('bills at most one step for a tab that was in the background', () => {
    // A backgrounded tab runs no animation frames, so the first frame back
    // reports the whole absence. At 100 px/s a ten-second gap would jump the
    // page a thousand pixels in one frame.
    const long = tick(initialState(0, 0), 10_000, 10_000);
    expect(long.scrollTo).toBe((100 * MAX_STEP_MS) / 1000);
  });

  it('does not scroll past the bottom of the page', () => {
    const atEnd = step(initialState(9_995, 0), {
      now: 0,
      elapsed: 1000,
      actual: 9_995,
      max: 10_000,
      speed: 100,
    });
    expect(atEnd.scrollTo).toBe(10_000);
  });

  it('treats a page with no scrollable range as already at its end', () => {
    const flat = step(initialState(0, 0), { now: 0, elapsed: 100, actual: 0, max: 0, speed: 100 });
    expect(flat.scrollTo).toBe(0);
  });
});

describe('initialState', () => {
  it('starts from where the page already is', () => {
    expect(initialState(742, 0).position).toBe(742);
  });

  it('does not move the page on the very first step', () => {
    const first = tick(initialState(742, 5_000), 5_000, 0);
    expect(first.scrollTo).toBe(742);
  });
});

describe('the end of the page', () => {
  const SHORT = { max: 1_000, speed: 100 };

  /** A step at the very bottom of a page that is not growing. */
  function atBottom(state: ScrollState, now: number, max = SHORT.max) {
    return step(state, { now, elapsed: 16, actual: Math.min(state.position, max), max, speed: 100 });
  }

  it('does not give up the moment it touches the bottom', () => {
    // An infinite feed grows underneath us. A crawl that stopped on first
    // reaching the end would never see what loaded a second later.
    const arrived = step(initialState(999, 0), { now: 0, elapsed: 100, actual: 999, ...SHORT });
    expect(arrived.finished).toBe(false);
  });

  it('finishes once the bottom has stopped moving', () => {
    let state = step(initialState(999, 0), { now: 0, elapsed: 100, actual: 999, ...SHORT }).state;
    const ended = atBottom(state, BOTTOM_STALL_MS + 1);
    expect(ended.finished).toBe(true);
  });

  it('keeps going while the page is still growing', () => {
    // Each step finds more page than the last, which is what an infinite feed
    // loading looks like from here.
    let state = initialState(999, 0);
    let max = 1_000;
    for (let now = 0; now < BOTTOM_STALL_MS * 3; now += 100) {
      const result = atBottom(state, now, max);
      expect(result.finished).toBe(false);
      state = result.state;
      max += 500;
    }
  });

  it('forgets the wait when the reader scrolls back up', () => {
    let state = atBottom(initialState(1_000, 0), 0).state;
    const scrolledUp = step(state, { now: 100, elapsed: 16, actual: 200, ...SHORT });
    const later = step(scrolledUp.state, {
      now: 100 + OVERRIDE_PAUSE_MS + 1,
      elapsed: 16,
      actual: 200,
      ...SHORT,
    });
    expect(later.finished).toBe(false);
  });

  it('is not finished part way down a page', () => {
    const middle = tick(initialState(0, 0), 0, 100);
    expect(middle.finished).toBe(false);
  });
});
